-- Owner memutuskan pengajuan override (soap_overrides) dengan membalas notifikasi
-- Telegram: "ok" = setujui, "ga" = tolak. Dipanggil HANYA oleh Edge Function
-- telegram-webhook (service role), setelah memastikan pesan berasal dari chat owner.
--
-- Notifikasi Telegram berisi "🔔 Pengajuan pengecualian: <label>\n<nama> - <alasan>".
-- Pengajuan dicocokkan lewat baris kedua (nama - alasan) di antara yang masih pending.
-- Keputusan dijalankan lewat soap_first_decide_override (logika bisnis tetap satu
-- sumber) dengan identitas owner klinik dipasang untuk transaksi ini saja.

CREATE OR REPLACE FUNCTION public.tg_decide_override(p_text text, p_approve boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_clinic constant uuid := 'bfdc3fd8-a052-4753-a5b7-229930b3237a';
  v_lines text[];
  v_label text;
  v_line text;
  v_ids uuid[];
  v_owner uuid;
  v_status text;
  v_err text;
BEGIN
  v_lines := string_to_array(replace(COALESCE(p_text, ''), E'\r', ''), E'\n');
  v_label := btrim(regexp_replace(COALESCE(v_lines[1], ''), '^.*Pengajuan pengecualian:\s*', ''));
  v_line := btrim(COALESCE(v_lines[2], ''));
  IF v_line = '' THEN
    RETURN '⚠️ Gagal: isi pengajuan tidak terbaca. Buka halaman Pengajuan di aplikasi.';
  END IF;

  SELECT array_agg(id ORDER BY requested_at DESC) INTO v_ids
  FROM soap_overrides
  WHERE clinic_id = v_clinic AND status = 'pending'
    AND COALESCE(requested_by_name, 'Admin') || ' - ' || btrim(reason) = v_line;

  IF v_ids IS NULL THEN
    SELECT status INTO v_status FROM soap_overrides
    WHERE clinic_id = v_clinic AND COALESCE(requested_by_name, 'Admin') || ' - ' || btrim(reason) = v_line
    ORDER BY requested_at DESC LIMIT 1;
    IF v_status = 'approved' THEN RETURN 'ℹ️ Pengajuan ini sudah disetujui sebelumnya.'; END IF;
    IF v_status = 'rejected' THEN RETURN 'ℹ️ Pengajuan ini sudah ditolak sebelumnya.'; END IF;
    RETURN '⚠️ Gagal: pengajuan tidak ditemukan.';
  END IF;
  IF array_length(v_ids, 1) > 1 THEN
    RETURN '⚠️ Ada ' || array_length(v_ids, 1) || ' pengajuan pending dengan isi yang sama. Putuskan lewat halaman Pengajuan di aplikasi.';
  END IF;

  SELECT u.id INTO v_owner FROM users u
  WHERE u.clinic_id = v_clinic AND u.role = 'owner' AND COALESCE(u.is_active, true)
  ORDER BY u.created_at LIMIT 1;
  IF v_owner IS NULL THEN
    RETURN '⚠️ Gagal: akun owner tidak ditemukan.';
  END IF;

  -- Identitas owner hanya berlaku di transaksi ini (is_local = true).
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  BEGIN
    PERFORM soap_first_decide_override(
      v_ids[1], p_approve,
      CASE WHEN p_approve THEN 'Disetujui lewat Telegram' ELSE 'Ditolak lewat Telegram' END);
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    RETURN '⚠️ Gagal ' || CASE WHEN p_approve THEN 'menyetujui' ELSE 'menolak' END || ': ' || v_err;
  END;

  RETURN CASE WHEN p_approve THEN '✅ Berhasil disetujui: ' ELSE '❌ Berhasil ditolak: ' END
    || v_label || E'\n' || v_line;
END;
$fn$;

REVOKE ALL ON FUNCTION public.tg_decide_override(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_decide_override(text, boolean) TO service_role;
