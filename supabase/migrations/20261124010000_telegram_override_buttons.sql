-- Tombol inline Telegram untuk pengajuan override: keputusan berdasarkan ID pengajuan.

CREATE OR REPLACE FUNCTION public.tg_decide_override_id(p_id uuid, p_approve boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_clinic constant uuid := 'bfdc3fd8-a052-4753-a5b7-229930b3237a';
  o soap_overrides;
  v_owner uuid;
  v_err text;
  v_desc text;
BEGIN
  SELECT * INTO o FROM soap_overrides WHERE id = p_id AND clinic_id = v_clinic;
  IF NOT FOUND THEN
    RETURN '⚠️ Gagal: pengajuan tidak ditemukan.';
  END IF;
  v_desc := COALESCE(o.requested_by_name, 'Admin') || ' - ' || btrim(o.reason);
  IF o.status = 'approved' THEN RETURN 'ℹ️ Pengajuan ini sudah disetujui sebelumnya.' || E'\n' || v_desc; END IF;
  IF o.status = 'rejected' THEN RETURN 'ℹ️ Pengajuan ini sudah ditolak sebelumnya.' || E'\n' || v_desc; END IF;

  SELECT u.id INTO v_owner FROM users u
  WHERE u.clinic_id = v_clinic AND u.role = 'owner' AND COALESCE(u.is_active, true)
  ORDER BY u.created_at LIMIT 1;
  IF v_owner IS NULL THEN
    RETURN '⚠️ Gagal: akun owner tidak ditemukan.';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  BEGIN
    PERFORM soap_first_decide_override(
      p_id, p_approve,
      CASE WHEN p_approve THEN 'Disetujui lewat Telegram' ELSE 'Ditolak lewat Telegram' END);
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    RETURN '⚠️ Gagal ' || CASE WHEN p_approve THEN 'menyetujui' ELSE 'menolak' END || ': ' || v_err;
  END;

  RETURN CASE WHEN p_approve THEN '✅ Berhasil disetujui' ELSE '❌ Berhasil ditolak' END || E'\n' || v_desc;
END;
$fn$;

REVOKE ALL ON FUNCTION public.tg_decide_override_id(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_decide_override_id(uuid, boolean) TO service_role;
