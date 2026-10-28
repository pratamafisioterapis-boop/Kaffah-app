-- Diskon ultah ("Birthday reward") khusus klinik dengan SOAP-first (Kaffah).
--
-- Aturan: berlaku dari tanggal ulang tahun sampai 1 bulan sesudahnya
-- (sama dengan masa promo di Follow Up Management), 1x per pasien per tahun.
-- Pemakaian dicatat di daily_recaps.birthday_reward_year; unique index
-- mencegah pemakaian ganda. Menghapus rekap otomatis membebaskan kuotanya.

ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS birthday_reward_year integer;

CREATE UNIQUE INDEX IF NOT EXISTS daily_recaps_birthday_reward_once_key
  ON public.daily_recaps (patient_id, birthday_reward_year)
  WHERE birthday_reward_year IS NOT NULL;

-- Status diskon ultah untuk seorang pasien pada tanggal rekap tertentu.
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

-- Validasi di rekap. Diberi prefix "aa_" agar jalan sebelum trigger penghitung diskon.
CREATE OR REPLACE FUNCTION public.trg_aa_birthday_reward_validate_on_recap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_clinic uuid;
  v_status jsonb;
BEGIN
  v_clinic := COALESCE(NEW.clinic_id, get_my_clinic_id());

  IF NEW.birthday_reward_year IS NULL THEN
    -- Melepas diskon ultah juga melepas potongannya.
    IF TG_OP = 'UPDATE' AND OLD.birthday_reward_year IS NOT NULL THEN
      NEW.discount_type := NULL;
      NEW.discount_value := 0;
      NEW.discount_label := NULL;
      RETURN NEW;
    END IF;

    -- Di klinik SOAP-first, diskon ultah hanya lewat kartu "Diskon tersedia".
    IF NEW.discount_label IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.discount_label IS DISTINCT FROM OLD.discount_label)
       AND lower(btrim(NEW.discount_label)) = 'birthday reward'
       AND EXISTS (SELECT 1 FROM soap_first_settings s WHERE s.clinic_id = v_clinic) THEN
      RAISE EXCEPTION 'Diskon "%" hanya bisa dipakai lewat kartu Diskon Ultah.', NEW.discount_label;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.birthday_reward_year IS NOT DISTINCT FROM NEW.birthday_reward_year THEN
    RETURN NEW;
  END IF;

  IF NEW.referral_reward_id IS NOT NULL THEN
    RAISE EXCEPTION 'Diskon ultah tidak bisa digabung dengan kode reward referral.';
  END IF;

  v_status := birthday_reward_status(NEW.patient_id, NEW.recap_date, NEW.id);

  IF COALESCE((v_status->>'hidden')::boolean, false) THEN
    RAISE EXCEPTION 'Pasien ini tidak berhak atas diskon ultah pada tanggal tersebut.';
  END IF;
  IF NOT (v_status->>'eligible')::boolean THEN
    RAISE EXCEPTION '%', v_status->>'reason';
  END IF;
  IF (v_status->>'year')::int IS DISTINCT FROM NEW.birthday_reward_year THEN
    RAISE EXCEPTION 'Periode diskon ultah tidak sesuai dengan tanggal rekap.';
  END IF;

  NEW.discount_type := v_status->>'discount_value_type';
  NEW.discount_value := (v_status->>'discount_value')::numeric;
  NEW.discount_label := v_status->>'discount_label';
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS aa_birthday_reward_validate ON public.daily_recaps;
CREATE TRIGGER aa_birthday_reward_validate
BEFORE INSERT OR UPDATE ON public.daily_recaps
FOR EACH ROW
EXECUTE FUNCTION public.trg_aa_birthday_reward_validate_on_recap();
