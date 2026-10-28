-- Diskon "Referral welcome reward" khusus klinik SOAP-first (Kaffah).
--
-- Berhak: pasien yang direkomendasikan pasien lain (patients.referred_by_patient_id
-- terisi). Dipakai 1x seumur pasien, tidak untuk paket dengan sesi > 1.
-- Pemakaian dicatat di daily_recaps.welcome_reward_used; unique index mencegah
-- pemakaian ganda. Pemakaian manual lama (label sama) dihitung sebagai sudah dipakai.
--
-- Urutan trigger BEFORE (alfabet): aa_referral -> ab_birthday -> ac_welcome ->
-- before_insert_update_apply_discount. Tiap trigger hanya melepas diskon bila
-- tidak ada reward lain yang baru dipasang di baris yang sama.

ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS welcome_reward_used boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS daily_recaps_welcome_reward_once_key
  ON public.daily_recaps (patient_id)
  WHERE welcome_reward_used;

CREATE OR REPLACE FUNCTION public.welcome_reward_status(
  p_patient_id uuid,
  p_recap_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_clinic uuid;
  v_referrer uuid;
  v_referrer_name text;
  v_opt operational_options%ROWTYPE;
  v_used uuid;
BEGIN
  SELECT p.clinic_id, p.referred_by_patient_id, r.full_name
  INTO v_clinic, v_referrer, v_referrer_name
  FROM patients p
  LEFT JOIN patients r ON r.id = p.referred_by_patient_id
  WHERE p.id = p_patient_id
    AND (get_my_role() = 'super_admin' OR p.clinic_id = get_my_clinic_id());

  IF v_clinic IS NULL
     OR v_referrer IS NULL
     OR NOT EXISTS (SELECT 1 FROM soap_first_settings s WHERE s.clinic_id = v_clinic) THEN
    RETURN jsonb_build_object('eligible', false, 'hidden', true);
  END IF;

  SELECT * INTO v_opt
  FROM operational_options o
  WHERE o.clinic_id = v_clinic
    AND o.category = 'discount_type'
    AND o.is_active
    AND lower(btrim(o.label)) = 'referral welcome reward'
  LIMIT 1;

  IF NOT FOUND OR v_opt.discount_value_type IS NULL OR COALESCE(v_opt.discount_value, 0) <= 0 THEN
    RETURN jsonb_build_object('eligible', false, 'hidden', true);
  END IF;

  SELECT id INTO v_used
  FROM daily_recaps
  WHERE patient_id = p_patient_id
    AND id IS DISTINCT FROM p_recap_id
    AND (welcome_reward_used OR lower(btrim(COALESCE(discount_label, ''))) = 'referral welcome reward')
  LIMIT 1;

  RETURN jsonb_build_object(
    'eligible', v_used IS NULL,
    'hidden', false,
    'reason', CASE WHEN v_used IS NOT NULL THEN 'Welcome reward sudah pernah dipakai.' END,
    'referrer_name', v_referrer_name,
    'option_id', v_opt.id,
    'discount_label', v_opt.label,
    'discount_value_type', v_opt.discount_value_type,
    'discount_value', v_opt.discount_value
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.welcome_reward_status(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_ac_welcome_reward_validate_on_recap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_clinic uuid;
  v_status jsonb;
  v_sessions int;
BEGIN
  v_clinic := COALESCE(NEW.clinic_id, get_my_clinic_id());

  IF NOT COALESCE(NEW.welcome_reward_used, false) THEN
    -- Melepas welcome reward juga melepas potongannya (kecuali reward lain baru dipasang).
    IF TG_OP = 'UPDATE' AND COALESCE(OLD.welcome_reward_used, false) THEN
      IF NEW.birthday_reward_year IS NULL AND NEW.referral_reward_id IS NULL THEN
        NEW.discount_type := NULL;
        NEW.discount_value := 0;
        NEW.discount_label := NULL;
      END IF;
      RETURN NEW;
    END IF;

    -- Di klinik SOAP-first, welcome reward hanya lewat kartu "Diskon tersedia".
    IF NEW.discount_label IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.discount_label IS DISTINCT FROM OLD.discount_label)
       AND lower(btrim(NEW.discount_label)) = 'referral welcome reward'
       AND EXISTS (SELECT 1 FROM soap_first_settings s WHERE s.clinic_id = v_clinic) THEN
      RAISE EXCEPTION 'Diskon "%" hanya bisa dipakai lewat kartu Diskon Welcome Reward.', NEW.discount_label;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.welcome_reward_used, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.referral_reward_id IS NOT NULL OR NEW.birthday_reward_year IS NOT NULL THEN
    RAISE EXCEPTION 'Welcome reward tidak bisa digabung dengan diskon lain.';
  END IF;

  -- Paket dengan sesi > 1 tidak boleh ada diskon.
  SELECT COALESCE(o.session_count, 0) INTO v_sessions
  FROM operational_options o
  WHERE o.clinic_id = v_clinic
    AND o.category = 'tipe_paket'
    AND lower(btrim(o.label)) = lower(btrim(COALESCE(NEW.package_type, '')))
  LIMIT 1;
  IF COALESCE(v_sessions, 0) > 1 THEN
    RAISE EXCEPTION 'Paket dengan lebih dari 1 sesi tidak boleh mendapat diskon.';
  END IF;

  v_status := welcome_reward_status(NEW.patient_id, NEW.id);

  IF COALESCE((v_status->>'hidden')::boolean, false) THEN
    RAISE EXCEPTION 'Pasien ini tidak berhak atas welcome reward.';
  END IF;
  IF NOT (v_status->>'eligible')::boolean THEN
    RAISE EXCEPTION '%', v_status->>'reason';
  END IF;

  NEW.discount_type := v_status->>'discount_value_type';
  NEW.discount_value := (v_status->>'discount_value')::numeric;
  NEW.discount_label := v_status->>'discount_label';
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS ac_welcome_reward_validate ON public.daily_recaps;
CREATE TRIGGER ac_welcome_reward_validate
BEFORE INSERT OR UPDATE ON public.daily_recaps
FOR EACH ROW
EXECUTE FUNCTION public.trg_ac_welcome_reward_validate_on_recap();

-- Trigger ultah dipindah ke "ab_" (setelah aa_referral) dan tidak menghapus
-- diskon bila reward referral baru dipasang pada baris yang sama.
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
    IF TG_OP = 'UPDATE' AND OLD.birthday_reward_year IS NOT NULL THEN
      IF NEW.referral_reward_id IS NULL THEN
        NEW.discount_type := NULL;
        NEW.discount_value := 0;
        NEW.discount_label := NULL;
      END IF;
      RETURN NEW;
    END IF;

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

  IF NEW.referral_reward_id IS NOT NULL OR COALESCE(NEW.welcome_reward_used, false) THEN
    RAISE EXCEPTION 'Diskon ultah tidak bisa digabung dengan diskon lain.';
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
DROP TRIGGER IF EXISTS ab_birthday_reward_validate ON public.daily_recaps;
CREATE TRIGGER ab_birthday_reward_validate
BEFORE INSERT OR UPDATE ON public.daily_recaps
FOR EACH ROW
EXECUTE FUNCTION public.trg_aa_birthday_reward_validate_on_recap();
