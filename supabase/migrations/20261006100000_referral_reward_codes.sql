-- Referral reward codes.
--
-- Until now a referral only produced a WhatsApp text in follow_up_queue; nothing
-- linked the reward to a patient or to the discount used in a daily recap.
-- This migration adds:
--   * referral_rewards: one row per reward, identified by a unique code
--   * operational_options.is_referral_reward: marks the "Jenis Diskon" that is
--     only usable through a code (hidden from the manual discount dropdown)
--   * daily_recaps.referral_reward_id: the reward claimed by a recap
--   * triggers that issue the code on patient save, validate/claim it in the
--     recap, and release it again when the recap drops it or is deleted.

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------
ALTER TABLE public.operational_options
  ADD COLUMN IF NOT EXISTS is_referral_reward boolean NOT NULL DEFAULT false;

-- Kaffah already has its own referral discount type; flag it instead of
-- creating a duplicate.
UPDATE public.operational_options
SET is_referral_reward = true
WHERE category = 'discount_type'
  AND lower(label) IN ('refferal reward', 'referral reward');

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  code text NOT NULL,
  referrer_patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  referred_patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  discount_option_id uuid REFERENCES public.operational_options(id) ON DELETE SET NULL,
  discount_label text,
  discount_value_type text NOT NULL CHECK (discount_value_type IN ('nominal', 'percentage')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  expires_at date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'claimed', 'expired', 'void')),
  claimed_recap_id uuid REFERENCES public.daily_recaps(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_rewards_clinic_code_key
  ON public.referral_rewards (clinic_id, code);
-- One reward per referred patient (a voided one may be replaced).
CREATE UNIQUE INDEX IF NOT EXISTS referral_rewards_one_per_referred_key
  ON public.referral_rewards (referred_patient_id) WHERE status <> 'void';
CREATE INDEX IF NOT EXISTS referral_rewards_referrer_idx
  ON public.referral_rewards (referrer_patient_id, status);

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clinic_isolated_referral_rewards ON public.referral_rewards;
CREATE POLICY clinic_isolated_referral_rewards ON public.referral_rewards
  FOR ALL
  USING ((get_my_role() = 'super_admin') OR (clinic_id = get_my_clinic_id()))
  WITH CHECK ((get_my_role() = 'super_admin') OR (clinic_id = get_my_clinic_id()));

ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS referral_reward_id uuid
  REFERENCES public.referral_rewards(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS daily_recaps_referral_reward_idx
  ON public.daily_recaps (referral_reward_id) WHERE referral_reward_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gen_referral_reward_code(p_clinic_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I/L
  v_code text;
  v_i int;
BEGIN
  LOOP
    v_code := 'REF-';
    FOR v_i IN 1..5 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM referral_rewards WHERE clinic_id = p_clinic_id AND code = v_code
    );
  END LOOP;
  RETURN v_code;
END;
$function$;

-- "Rp100.000" / "25%"
CREATE OR REPLACE FUNCTION public.format_referral_reward_value(p_type text, p_value numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p_type = 'percentage' THEN trim(trailing '.' FROM trim(trailing '0' FROM round(p_value, 2)::text)) || '%'
    ELSE 'Rp' || replace(to_char(round(p_value), 'FM999,999,999,999'), ',', '.')
  END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Issue the code when a patient is saved with a referrer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_referral_reward_on_patient_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_referrer_name text;
  v_referrer_nickname text;
  v_referrer_phone text;
  v_template text;
  v_message text;
  v_sapaan text;
  v_waktu text;
  v_jam_now int;
  v_berlaku_date date;
  v_masa_berlaku text;
  v_opt record;
  v_validity int;
  v_code text;
  v_reward_id uuid;
  v_nilai text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.referred_by_patient_id IS NOT DISTINCT FROM NEW.referred_by_patient_id THEN
    RETURN NEW;
  END IF;

  -- Referrer changed or removed: the old, unclaimed reward is void and its
  -- not-yet-sent message is withdrawn. A claimed reward stays untouched.
  IF TG_OP = 'UPDATE' AND OLD.referred_by_patient_id IS NOT NULL THEN
    UPDATE referral_rewards
    SET status = 'void', updated_at = now()
    WHERE referred_patient_id = NEW.id AND status IN ('active', 'expired');

    DELETE FROM follow_up_queue
    WHERE follow_up_type = 'referral_reward'
      AND source_table = 'patients'
      AND source_id = NEW.id
      AND patient_id = OLD.referred_by_patient_id
      AND status = 'pending';
  END IF;

  IF NEW.referred_by_patient_id IS NULL OR NEW.referred_by_patient_id = NEW.id THEN
    RETURN NEW;
  END IF;

  -- Already rewarded (e.g. claimed) for this referred patient: don't issue another.
  IF EXISTS (
    SELECT 1 FROM referral_rewards
    WHERE referred_patient_id = NEW.id AND status <> 'void'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT full_name, nickname, phone
  INTO v_referrer_name, v_referrer_nickname, v_referrer_phone
  FROM patients WHERE id = NEW.referred_by_patient_id;

  IF v_referrer_phone IS NULL OR trim(v_referrer_phone) = '' THEN
    RETURN NEW;
  END IF;

  -- Reward discount type of this clinic (created with a default on first use).
  SELECT id, label, discount_value_type, discount_value, validity_days
  INTO v_opt
  FROM operational_options
  WHERE clinic_id = NEW.clinic_id
    AND category = 'discount_type'
    AND is_referral_reward
    AND is_active
    AND discount_value_type IS NOT NULL
    AND COALESCE(discount_value, 0) > 0
  ORDER BY created_at
  LIMIT 1;

  IF v_opt.id IS NULL THEN
    INSERT INTO operational_options (clinic_id, category, label, is_active, discount_value_type, discount_value, is_referral_reward)
    VALUES (NEW.clinic_id, 'discount_type', 'Referral Reward', true, 'nominal', 100000, true)
    RETURNING id, label, discount_value_type, discount_value, validity_days INTO v_opt;
  END IF;

  v_validity := COALESCE(NULLIF(v_opt.validity_days, 0), 30);
  v_berlaku_date := ((NOW() AT TIME ZONE 'Asia/Makassar')::date) + v_validity;
  v_code := gen_referral_reward_code(NEW.clinic_id);

  INSERT INTO referral_rewards (
    clinic_id, code, referrer_patient_id, referred_patient_id, discount_option_id,
    discount_label, discount_value_type, discount_value, expires_at
  ) VALUES (
    NEW.clinic_id, v_code, NEW.referred_by_patient_id, NEW.id, v_opt.id,
    v_opt.label, v_opt.discount_value_type, v_opt.discount_value, v_berlaku_date
  )
  RETURNING id INTO v_reward_id;

  v_sapaan := COALESCE(NULLIF(v_referrer_nickname, ''), 'Ka ' || v_referrer_name);

  v_jam_now := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Asia/Makassar'))::int;
  v_waktu := CASE
    WHEN v_jam_now >= 4 AND v_jam_now < 11 THEN 'Selamat Pagi'
    WHEN v_jam_now >= 11 AND v_jam_now < 15 THEN 'Selamat Siang'
    WHEN v_jam_now >= 15 AND v_jam_now < 18 THEN 'Selamat Sore'
    ELSE 'Selamat Malam'
  END;

  v_masa_berlaku := (CASE EXTRACT(DOW FROM v_berlaku_date)
    WHEN 0 THEN 'Minggu' WHEN 1 THEN 'Senin' WHEN 2 THEN 'Selasa'
    WHEN 3 THEN 'Rabu' WHEN 4 THEN 'Kamis' WHEN 5 THEN 'Jumat' WHEN 6 THEN 'Sabtu'
  END) || ', ' || EXTRACT(DAY FROM v_berlaku_date)::int || ' ' || (CASE EXTRACT(MONTH FROM v_berlaku_date)
    WHEN 1 THEN 'Januari' WHEN 2 THEN 'Februari' WHEN 3 THEN 'Maret'
    WHEN 4 THEN 'April' WHEN 5 THEN 'Mei' WHEN 6 THEN 'Juni'
    WHEN 7 THEN 'Juli' WHEN 8 THEN 'Agustus' WHEN 9 THEN 'September'
    WHEN 10 THEN 'Oktober' WHEN 11 THEN 'November' WHEN 12 THEN 'Desember'
  END) || ' ' || EXTRACT(YEAR FROM v_berlaku_date)::int;

  v_nilai := format_referral_reward_value(v_opt.discount_value_type, v_opt.discount_value);

  SELECT template_text INTO v_template
  FROM wa_templates
  WHERE category = 'referral_reward' AND is_enabled = true AND clinic_id = NEW.clinic_id
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_template IS NULL THEN
    v_template := '[waktu] [sapaan]! 🎉 Terima kasih sudah merekomendasikan [nama_pasien_baru] untuk terapi di klinik kami. Sebagai ucapan terima kasih, [nickname] berhak mendapat potongan [nilai_reward] di kunjungan berikutnya (berlaku hingga [masa_berlaku]).' || E'\n\n' || '🔑 Kode Reward: [kode_reward]' || E'\n' || 'Sebutkan kode ini ke admin saat klaim ya 🙏';
  END IF;

  v_message := v_template;
  v_message := replace(v_message, '[waktu]', v_waktu);
  v_message := replace(v_message, '[sapaan]', v_sapaan);
  v_message := replace(v_message, '[nickname]', COALESCE(NULLIF(v_referrer_nickname, ''), v_referrer_name));
  v_message := replace(v_message, '[nama]', v_referrer_name);
  v_message := replace(v_message, '[nama_pasien_baru]', NEW.full_name);
  v_message := replace(v_message, '[masa_berlaku]', v_masa_berlaku);
  v_message := replace(v_message, '[nilai_reward]', v_nilai);
  v_message := replace(v_message, '[kode_reward]', v_code);

  -- A custom template without [kode_reward] must still carry the code,
  -- otherwise the reward could never be claimed.
  IF position('[kode_reward]' in v_template) = 0 THEN
    v_message := v_message || E'\n\n' || '🔑 Kode Reward: ' || v_code;
  END IF;

  INSERT INTO follow_up_queue (
    patient_id, phone_number, follow_up_type, source_id, source_table,
    message_content, scheduled_date, scheduled_time, status, clinic_id
  ) VALUES (
    NEW.referred_by_patient_id, v_referrer_phone, 'referral_reward', NEW.id, 'patients',
    v_message, CURRENT_DATE, CURRENT_TIME, 'pending', NEW.clinic_id
  )
  ON CONFLICT (patient_id, follow_up_type, scheduled_date, source_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Validate / claim / release in daily_recaps
-- ---------------------------------------------------------------------------
-- Named "aa_" so it runs before before_insert_update_apply_discount, which
-- derives the final amount from discount_type/discount_value.
CREATE OR REPLACE FUNCTION public.trg_aa_referral_reward_validate_on_recap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  r referral_rewards%ROWTYPE;
  v_clinic uuid;
BEGIN
  IF NEW.referral_reward_id IS NULL THEN
    -- Dropping the code also drops the discount it granted.
    IF TG_OP = 'UPDATE' AND OLD.referral_reward_id IS NOT NULL THEN
      NEW.discount_type := NULL;
      NEW.discount_value := 0;
      NEW.discount_label := NULL;
      RETURN NEW;
    END IF;

    -- The reward discount type can only be used through its code.
    IF NEW.discount_label IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.discount_label IS DISTINCT FROM OLD.discount_label) THEN
      v_clinic := COALESCE(NEW.clinic_id, get_my_clinic_id());
      IF EXISTS (
        SELECT 1 FROM operational_options o
        WHERE o.clinic_id = v_clinic
          AND o.category = 'discount_type'
          AND o.is_referral_reward
          AND lower(o.label) = lower(NEW.discount_label)
      ) THEN
        RAISE EXCEPTION 'Diskon "%" hanya bisa dipakai dengan memasukkan Kode Reward.', NEW.discount_label;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Unchanged on update: keep as is (already validated when it was set).
  IF TG_OP = 'UPDATE' AND OLD.referral_reward_id IS NOT DISTINCT FROM NEW.referral_reward_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO r FROM referral_rewards WHERE id = NEW.referral_reward_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kode reward tidak ditemukan.';
  END IF;
  IF r.referrer_patient_id IS DISTINCT FROM NEW.patient_id THEN
    RAISE EXCEPTION 'Kode reward % bukan milik pasien ini.', r.code;
  END IF;
  IF r.status = 'void' THEN
    RAISE EXCEPTION 'Kode reward % sudah tidak berlaku.', r.code;
  END IF;
  IF r.status = 'claimed' AND r.claimed_recap_id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Kode reward % sudah pernah dipakai.', r.code;
  END IF;
  IF r.status <> 'claimed' AND r.expires_at < (NOW() AT TIME ZONE 'Asia/Makassar')::date THEN
    UPDATE referral_rewards SET status = 'expired', updated_at = now() WHERE id = r.id AND status = 'active';
    RAISE EXCEPTION 'Kode reward % sudah kedaluwarsa (berlaku hingga %).', r.code, to_char(r.expires_at, 'DD-MM-YYYY');
  END IF;

  NEW.discount_type := r.discount_value_type;
  NEW.discount_value := r.discount_value;
  NEW.discount_label := COALESCE(r.discount_label, 'Referral Reward');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS aa_referral_reward_validate ON public.daily_recaps;
CREATE TRIGGER aa_referral_reward_validate
BEFORE INSERT OR UPDATE ON public.daily_recaps
FOR EACH ROW
EXECUTE FUNCTION public.trg_aa_referral_reward_validate_on_recap();

CREATE OR REPLACE FUNCTION public.trg_referral_reward_claim_on_recap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_old_id uuid;
  v_new_id uuid;
  v_recap_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_id := OLD.referral_reward_id;
    v_new_id := NULL;
    v_recap_id := OLD.id;
  ELSE
    v_old_id := CASE WHEN TG_OP = 'UPDATE' THEN OLD.referral_reward_id ELSE NULL END;
    v_new_id := NEW.referral_reward_id;
    v_recap_id := NEW.id;
  END IF;

  IF v_old_id IS NOT NULL AND v_old_id IS DISTINCT FROM v_new_id THEN
    UPDATE referral_rewards
    SET status = CASE WHEN expires_at < (NOW() AT TIME ZONE 'Asia/Makassar')::date THEN 'expired' ELSE 'active' END,
        claimed_recap_id = NULL,
        claimed_at = NULL,
        updated_at = now()
    WHERE id = v_old_id
      AND status = 'claimed'
      AND (claimed_recap_id = v_recap_id OR claimed_recap_id IS NULL);
  END IF;

  IF v_new_id IS NOT NULL THEN
    UPDATE referral_rewards
    SET status = 'claimed',
        claimed_recap_id = v_recap_id,
        claimed_at = COALESCE(claimed_at, now()),
        updated_at = now()
    WHERE id = v_new_id;
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_referral_reward_claim ON public.daily_recaps;
CREATE TRIGGER trg_referral_reward_claim
AFTER INSERT OR UPDATE OF referral_reward_id OR DELETE ON public.daily_recaps
FOR EACH ROW
EXECUTE FUNCTION public.trg_referral_reward_claim_on_recap();

-- ---------------------------------------------------------------------------
-- 5. Code lookup for the recap form (gives a reason when the code is unusable)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_referral_reward(p_code text, p_patient_id uuid, p_recap_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  r referral_rewards%ROWTYPE;
  v_reason text;
BEGIN
  SELECT * INTO r
  FROM referral_rewards
  WHERE upper(code) = upper(trim(p_code))
    AND (get_my_role() = 'super_admin' OR clinic_id = get_my_clinic_id())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Kode reward tidak ditemukan.');
  END IF;

  IF r.referrer_patient_id IS DISTINCT FROM p_patient_id THEN
    v_reason := 'Kode reward ini bukan milik pasien yang dipilih.';
  ELSIF r.status = 'void' THEN
    v_reason := 'Kode reward sudah tidak berlaku.';
  ELSIF r.status = 'claimed' AND r.claimed_recap_id IS DISTINCT FROM p_recap_id THEN
    v_reason := 'Kode reward sudah pernah dipakai.';
  ELSIF r.status <> 'claimed' AND r.expires_at < (NOW() AT TIME ZONE 'Asia/Makassar')::date THEN
    v_reason := 'Kode reward sudah kedaluwarsa (berlaku hingga ' || to_char(r.expires_at, 'DD-MM-YYYY') || ').';
  END IF;

  RETURN jsonb_build_object(
    'valid', v_reason IS NULL,
    'reason', v_reason,
    'id', r.id,
    'code', r.code,
    'discount_value_type', r.discount_value_type,
    'discount_value', r.discount_value,
    'discount_label', COALESCE(r.discount_label, 'Referral Reward'),
    'expires_at', r.expires_at
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.lookup_referral_reward(text, uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Templates: new placeholders [kode_reward] and [nilai_reward]
-- ---------------------------------------------------------------------------
-- Nominal written into the text is replaced by the real reward value, and the
-- code line is added to templates that don't have it yet.
UPDATE wa_templates
SET template_text = replace(
      replace(
        replace(template_text, '✨ Referral Reward: Rp100.000 OFF', '✨ Referral Reward: [nilai_reward] OFF'),
        'potongan Rp100.000', 'potongan [nilai_reward]'),
      '⏳ Berlaku hingga [masa_berlaku]',
      '⏳ Berlaku hingga [masa_berlaku]' || E'\n' || '🔑 Kode Reward: *[kode_reward]*'),
    placeholders = '["sapaan","nickname","nama","nama_pasien_baru","waktu","masa_berlaku","kode_reward","nilai_reward"]'::jsonb,
    updated_at = timezone('utc'::text, now())
WHERE category = 'referral_reward'
  AND template_text LIKE '%⏳ Berlaku hingga [masa_berlaku]%'
  AND template_text NOT LIKE '%[kode_reward]%';

UPDATE wa_templates
SET template_text = replace(
      template_text,
      'Silakan hubungi kami untuk klaim promonya ya 🙏',
      E'\n\n' || '🔑 Kode Reward: *[kode_reward]*' || E'\n' || 'Sebutkan kode ini ke admin saat klaim ya 🙏'),
    placeholders = '["sapaan","nickname","nama","nama_pasien_baru","waktu","masa_berlaku","kode_reward","nilai_reward"]'::jsonb,
    updated_at = timezone('utc'::text, now())
WHERE category = 'referral_reward'
  AND template_text LIKE '%Silakan hubungi kami untuk klaim promonya ya 🙏%'
  AND template_text NOT LIKE '%[kode_reward]%';
