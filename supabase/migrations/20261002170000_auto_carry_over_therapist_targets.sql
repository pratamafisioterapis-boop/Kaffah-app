-- Target terapis yang belum tercapai di periode sebelumnya otomatis dibuat
-- ulang (jumlah target sama) untuk periode berjalan. Dijalankan harian lewat
-- pg_cron sehingga tetap jalan di awal periode tanpa perlu owner membuka
-- halaman Target. Kalau target periode sebelumnya tercapai, tidak dibuat
-- otomatis: owner diberi notifikasi di dashboard untuk mengisi target baru.
CREATE OR REPLACE FUNCTION public.carry_over_unmet_therapist_targets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  v_prev RECORD;
  v_cur_start date;
  v_cur_end date;
  v_actual integer;
  v_created integer := 0;
BEGIN
  FOR rec IN SELECT id FROM physiotherapists WHERE is_active IS TRUE LOOP
    SELECT period_start, period_end INTO v_cur_start, v_cur_end
    FROM get_therapist_period_range(rec.id, CURRENT_DATE);

    -- Periode berjalan sudah punya target -> lewati.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM therapist_targets t
      WHERE t.therapist_id = rec.id
        AND t.start_date <= v_cur_end AND t.end_date >= v_cur_start
    );

    SELECT * INTO v_prev FROM therapist_targets t
    WHERE t.therapist_id = rec.id AND t.end_date < v_cur_start
    ORDER BY t.end_date DESC LIMIT 1;
    CONTINUE WHEN v_prev.id IS NULL OR v_prev.target_visits <= 0;

    SELECT count(*) INTO v_actual FROM daily_recaps dr
    WHERE dr.therapist_id = rec.id
      AND dr.recap_date BETWEEN v_prev.start_date AND v_prev.end_date
      AND NOT (COALESCE(v_prev.excluded_patient_types, '[]'::jsonb) ? COALESCE(dr.patient_type, ''));

    CONTINUE WHEN v_actual >= v_prev.target_visits; -- tercapai: owner isi manual

    INSERT INTO therapist_targets
      (clinic_id, therapist_id, start_date, end_date, target_visits,
       excluded_patient_types, auto_generated, base_target_id)
    VALUES
      (v_prev.clinic_id, rec.id, v_cur_start, v_cur_end, v_prev.target_visits,
       COALESCE(v_prev.excluded_patient_types, '[]'::jsonb), true, v_prev.id);
    v_created := v_created + 1;
  END LOOP;
  RETURN v_created;
END;
$function$;

-- 00:05 WITA setiap hari (16:05 UTC); idempotent.
SELECT cron.schedule('carry-over-unmet-therapist-targets', '5 16 * * *',
  $$select public.carry_over_unmet_therapist_targets()$$);
