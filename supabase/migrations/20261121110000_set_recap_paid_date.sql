-- Koreksi tanggal pembayaran recap yang diinput terlambat.
-- invoice_created_at diisi now() oleh trigger saat invoice terbit, sehingga recap terapi
-- 20 Nov yang baru diinput 21 Nov tercatat "Dibayar 21 Nov" (revenue_date ikut 21 Nov).
-- Fungsi ini mengubah tanggal bayar (invoice_created_at) ke tanggal antara tanggal terapi
-- sampai hari ini (WITA); revenue_date dihitung ulang oleh trigger zzz_set_revenue_date.
CREATE OR REPLACE FUNCTION public.set_recap_paid_date(p_recap_id uuid, p_paid_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_today date := (now() AT TIME ZONE 'Asia/Makassar')::date;
  v_role text := get_my_role();
  v_new timestamptz;
  v_cur date;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('owner', 'super_admin', 'admin', 'clinic_admin') THEN
    RAISE EXCEPTION 'Tidak berhak mengubah tanggal bayar.';
  END IF;

  SELECT d.id, d.clinic_id, d.recap_date, d.invoice_created_at INTO r
  FROM daily_recaps d WHERE d.id = p_recap_id FOR UPDATE;
  IF NOT FOUND OR (v_role <> 'super_admin' AND r.clinic_id IS DISTINCT FROM get_my_clinic_id()) THEN
    RAISE EXCEPTION 'Recap tidak ditemukan.';
  END IF;
  IF r.invoice_created_at IS NULL THEN
    RAISE EXCEPTION 'Invoice belum terbit, belum ada tanggal bayar.';
  END IF;
  IF p_paid_date IS NULL OR p_paid_date > v_today THEN
    RAISE EXCEPTION 'Tanggal bayar tidak boleh di masa depan.';
  END IF;
  IF p_paid_date < r.recap_date THEN
    RAISE EXCEPTION 'Tanggal bayar tidak boleh sebelum tanggal terapi.';
  END IF;

  v_cur := (r.invoice_created_at AT TIME ZONE 'Asia/Makassar')::date;
  IF v_cur = p_paid_date THEN
    RETURN jsonb_build_object('recap_id', r.id, 'paid_date', p_paid_date, 'changed', false);
  END IF;

  -- Hari ini: pakai waktu sekarang; hari lampau: jam 12:00 WITA agar tidak bergeser tanggal.
  v_new := CASE WHEN p_paid_date = v_today THEN now()
                ELSE ((p_paid_date::text || ' 12:00:00')::timestamp AT TIME ZONE 'Asia/Makassar') END;

  PERFORM set_config('app.soap_first_rpc', 'on', true);
  UPDATE daily_recaps SET invoice_created_at = v_new, updated_at = now() WHERE id = r.id;
  PERFORM set_config('app.soap_first_rpc', 'off', true);

  RETURN jsonb_build_object('recap_id', r.id, 'paid_date', p_paid_date, 'changed', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_recap_paid_date(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_recap_paid_date(uuid, date) TO authenticated;
