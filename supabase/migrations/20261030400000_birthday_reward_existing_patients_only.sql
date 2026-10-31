-- Diskon ultah hanya untuk pasien lama.
--
-- Bug: pasien yang baru pertama kali berobat HARI INI (tapi tanggal lahirnya
-- jatuh dalam masa promo 1 bulan sesudah ultah) ikut mendapat kartu
-- "Birthday reward". Padahal promo ini apresiasi untuk pasien yang sudah jadi
-- pasien klinik sebelum ulang tahunnya.
--
-- Aturan baru: pasien berhak bila (a) sudah punya rekap (kunjungan) pada/sebelum
-- tanggal ulang tahun, atau (b) berobat tepat di hari H ulang tahunnya.
-- Pasien baru yang kunjungan pertamanya SESUDAH tanggal ulang tahun tidak berhak.
--
-- Pengecekan ada di birthday_reward_status, sehingga berlaku untuk kartu di
-- UI sekaligus trigger validasi di daily_recaps (tidak bisa ditembus lewat API).

CREATE OR REPLACE FUNCTION public.birthday_reward_status(
  p_patient_id uuid,
  p_recap_date date,
  p_recap_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_birth date;
  v_clinic uuid;
  v_opt operational_options%ROWTYPE;
  v_year int;
  v_start date;
  v_end date;
  v_used uuid;
  v_y int;
BEGIN
  SELECT birth_date, clinic_id INTO v_birth, v_clinic
  FROM patients
  WHERE id = p_patient_id
    AND (get_my_role() = 'super_admin' OR clinic_id = get_my_clinic_id());

  -- Hanya klinik SOAP-first (Kaffah) & pasien dengan tanggal lahir.
  IF v_clinic IS NULL
     OR v_birth IS NULL
     OR NOT EXISTS (SELECT 1 FROM soap_first_settings s WHERE s.clinic_id = v_clinic) THEN
    RETURN jsonb_build_object('eligible', false, 'hidden', true);
  END IF;

  SELECT * INTO v_opt
  FROM operational_options o
  WHERE o.clinic_id = v_clinic
    AND o.category = 'discount_type'
    AND o.is_active
    AND lower(btrim(o.label)) = 'birthday reward'
  LIMIT 1;

  IF NOT FOUND OR v_opt.discount_value_type IS NULL OR COALESCE(v_opt.discount_value, 0) <= 0 THEN
    RETURN jsonb_build_object('eligible', false, 'hidden', true);
  END IF;

  FOREACH v_y IN ARRAY ARRAY[EXTRACT(year FROM p_recap_date)::int - 1, EXTRACT(year FROM p_recap_date)::int] LOOP
    v_start := make_date(v_y, EXTRACT(month FROM v_birth)::int, 1)
               + (LEAST(EXTRACT(day FROM v_birth)::int,
                        EXTRACT(day FROM (make_date(v_y, EXTRACT(month FROM v_birth)::int, 1) + interval '1 month - 1 day'))::int) - 1);
    v_end := (v_start + interval '1 month')::date;
    IF p_recap_date BETWEEN v_start AND v_end THEN
      v_year := v_y;
      EXIT;
    END IF;
  END LOOP;

  IF v_year IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'hidden', true);
  END IF;

  -- Pasien baru yang belum pernah berobat sampai hari ulang tahunnya tidak
  -- berhak, kecuali berobat tepat di hari H.
  IF p_recap_date <> v_start AND NOT EXISTS (
    SELECT 1
    FROM daily_recaps r
    WHERE r.patient_id = p_patient_id
      AND r.recap_date <= v_start
      AND r.id IS DISTINCT FROM p_recap_id
  ) THEN
    RETURN jsonb_build_object('eligible', false, 'hidden', true);
  END IF;

  SELECT id INTO v_used
  FROM daily_recaps
  WHERE patient_id = p_patient_id
    AND birthday_reward_year = v_year
    AND id IS DISTINCT FROM p_recap_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'eligible', v_used IS NULL,
    'hidden', false,
    'reason', CASE WHEN v_used IS NOT NULL THEN 'Diskon ultah tahun ' || v_year || ' sudah dipakai.' END,
    'year', v_year,
    'window_start', v_start,
    'window_end', v_end,
    'option_id', v_opt.id,
    'discount_label', v_opt.label,
    'discount_value_type', v_opt.discount_value_type,
    'discount_value', v_opt.discount_value
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.birthday_reward_status(uuid, date, uuid) TO authenticated;
