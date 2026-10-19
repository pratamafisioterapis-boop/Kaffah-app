-- Lanjutan 20261019100000: begitu sesi Recovery dilepas dari paket, recap lain pasien yang sama
-- di hari yang sama (belum tertaut paket, belum dibayar) otomatis menempati kuota yang kembali.
-- Hanya bila kandidatnya tepat satu.
CREATE OR REPLACE FUNCTION public.recovery_outside_package_apply(
  p_recap_id uuid, p_outside boolean, p_reason text, p_diagnosis jsonb, p_by uuid, p_allow_paid boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  c_kaffah constant uuid := 'bfdc3fd8-a052-4753-a5b7-229930b3237a';
  r daily_recaps;
  v_pkg package_tracking;
  v_diag jsonb;
  v_used integer;
  v_prev text := COALESCE(current_setting('app.soap_first_rpc', true), '');
  v_paid boolean;
  v_cand_count integer;
  v_cand_id uuid;
BEGIN
  SELECT * INTO r FROM daily_recaps WHERE id = p_recap_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recap tidak ditemukan.';
  END IF;
  IF r.clinic_id IS DISTINCT FROM c_kaffah THEN
    RAISE EXCEPTION 'Fitur ini hanya tersedia untuk klinik Kaffah.';
  END IF;

  IF p_outside THEN
    IF r.package_tracking_id IS NULL THEN
      RAISE EXCEPTION 'Sesi ini tidak memakai kuota paket.';
    END IF;
    IF COALESCE(r.amount_original, r.amount, 0) <> 0 THEN
      RAISE EXCEPTION 'Sesi pembelian paket tidak dapat diambil di luar paket.';
    END IF;
    SELECT * INTO v_pkg FROM package_tracking WHERE id = r.package_tracking_id;
    IF v_pkg.package_name ILIKE '% RU' THEN
      RAISE EXCEPTION 'Paket RU sudah khusus recovery, tidak perlu dikeluarkan dari paket.';
    END IF;

    v_diag := COALESCE(p_diagnosis, r.diagnosis);
    IF NOT EXISTS (
      SELECT 1 FROM operational_options o
      WHERE o.clinic_id = r.clinic_id AND o.category = 'diagnosa'
        AND o.id::text = ANY (soap_first_diag_ids(v_diag))
        AND o.label ILIKE 'doms%'
    ) THEN
      RAISE EXCEPTION 'Recovery di luar paket hanya untuk diagnosa DOMS.';
    END IF;

    PERFORM set_config('app.soap_first_rpc', 'on', true);
    UPDATE daily_recaps
    SET diagnosis = v_diag,
        bypass_package_id = r.package_tracking_id,
        bypass_reason = p_reason,
        bypass_at = now(),
        bypass_by = p_by,
        package_tracking_id = NULL,
        amount_package = NULL,
        session_info = NULL,
        package_type = 'REGULER',
        payment_method = NULL,
        updated_at = now()
    WHERE id = p_recap_id;
    PERFORM set_config('app.soap_first_rpc', v_prev, true);

    -- Kuota yang baru kembali dipakai recap lain pasien yang sama di hari yang sama
    -- (belum tertaut paket, belum dibayar), mis. sesi kedua untuk menyelesaikan sisa paket.
    -- Hanya bila kandidatnya tepat satu, supaya tidak menebak.
    SELECT COUNT(*), (array_agg(d.id))[1] INTO v_cand_count, v_cand_id
    FROM daily_recaps d
    WHERE d.clinic_id = r.clinic_id
      AND d.patient_id = r.patient_id
      AND d.recap_date = r.recap_date
      AND d.id <> r.id
      AND d.package_tracking_id IS NULL
      AND d.bypass_package_id IS NULL
      AND d.invoice_created_at IS NULL
      AND d.special_type IS NULL
      AND COALESCE(d.amount, 0) = 0
      AND (d.payment_method IS NULL OR d.payment_method = 'Package');
    IF v_cand_count = 1 THEN
      PERFORM set_config('app.soap_first_rpc', 'on', true);
      UPDATE daily_recaps
      SET package_tracking_id = r.package_tracking_id,
          package_type = v_pkg.package_name,
          payment_method = 'Package',
          amount = 0,
          amount_original = 0,
          updated_at = now()
      WHERE id = v_cand_id;
      PERFORM set_config('app.soap_first_rpc', v_prev, true);
    END IF;
  ELSE
    IF r.bypass_package_id IS NULL THEN
      RAISE EXCEPTION 'Sesi ini tidak ditandai di luar paket.';
    END IF;
    SELECT * INTO v_pkg FROM package_tracking WHERE id = r.bypass_package_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Paket asal sudah tidak ada.';
    END IF;
    IF v_pkg.status NOT IN ('aktif', 'diperpanjang')
       OR r.recap_date < v_pkg.start_date
       OR r.recap_date > COALESCE(v_pkg.extended_until, v_pkg.end_date) THEN
      RAISE EXCEPTION 'Paket asal sudah tidak aktif pada tanggal sesi ini.';
    END IF;
    SELECT COUNT(*) INTO v_used FROM daily_recaps WHERE package_tracking_id = v_pkg.id;
    IF v_used >= v_pkg.total_sessions THEN
      RAISE EXCEPTION 'Sisa sesi paket sudah habis, sesi tidak dapat dikembalikan.';
    END IF;

    v_paid := r.invoice_created_at IS NOT NULL
      OR COALESCE(r.amount, 0) > 0
      OR (r.payment_method IS NOT NULL AND r.payment_method <> 'Package');
    IF v_paid AND NOT p_allow_paid THEN
      RAISE EXCEPTION 'Invoice sudah terbit. Ajukan pengecualian ke owner.';
    END IF;

    PERFORM set_config('app.soap_first_rpc', 'on', true);
    IF v_paid THEN
      DELETE FROM daily_recap_payment_splits WHERE recap_id = p_recap_id;
    END IF;
    UPDATE daily_recaps
    SET package_tracking_id = v_pkg.id,
        package_type = v_pkg.package_name,
        payment_method = 'Package',
        amount = 0,
        amount_original = 0,
        discount_type = NULL,
        discount_value = 0,
        discount_label = NULL,
        invoice_created_at = NULL,
        bypass_package_id = NULL,
        bypass_reason = NULL,
        bypass_at = NULL,
        bypass_by = NULL,
        updated_at = now()
    WHERE id = p_recap_id;
    PERFORM set_config('app.soap_first_rpc', v_prev, true);
  END IF;
END;
$fn$;

