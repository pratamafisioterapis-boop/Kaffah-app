-- Referral reward feature: when a new patient who was referred by an existing
-- patient gets their first completed daily_recap (first confirmed therapy
-- session), automatically enqueue a WhatsApp "reward" message to the
-- referring (old) patient in follow_up_queue, under a new
-- follow_up_type = 'referral_reward'. Admin still reviews/sends it manually
-- from the Follow Up Management "Reward" tab, same as the current
-- 'follow_up' category (auto-send via cron was already disabled for that
-- category earlier today).

-- 1. Track who referred a patient
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS referred_by_patient_id uuid REFERENCES patients(id) ON DELETE SET NULL;

ALTER TABLE patients
  ADD CONSTRAINT chk_patients_no_self_referral
  CHECK (referred_by_patient_id IS NULL OR referred_by_patient_id <> id);

CREATE INDEX IF NOT EXISTS idx_patients_referred_by ON patients(referred_by_patient_id);

-- 2. Allow 'referral_reward' as a wa_templates category so owners can edit
-- its message text from Settings > WhatsApp, same as other categories.
ALTER TABLE wa_templates DROP CONSTRAINT IF EXISTS wa_templates_category_check;
ALTER TABLE wa_templates ADD CONSTRAINT wa_templates_category_check
  CHECK (category = ANY (ARRAY[
    'birthday'::text, 'booking_appointment'::text, 'booking_appointment_homecare'::text,
    'follow_up'::text, 'package_expiry'::text, 'therapy_reminder'::text,
    'therapy_reminder_homecare'::text, 'daily_report'::text, 'reschedule_appointment'::text,
    'referral_reward'::text
  ]));

-- 3. Seed a default referral_reward template per clinic so the category has
-- content immediately; owners can edit it via WhatsApp Settings like any other.
INSERT INTO wa_templates (category, clinic_id, template_text, placeholders, is_enabled)
SELECT
  'referral_reward',
  c.id,
  'Halo [sapaan]! 🎉 Terima kasih banyak sudah merekomendasikan [nama_pasien_baru] untuk terapi di klinik kami. Sebagai ucapan terima kasih, [nickname] berhak mendapat promo spesial di kunjungan berikutnya. Silakan hubungi kami untuk klaim promonya ya 🙏',
  '["sapaan","nickname","nama","nama_pasien_baru"]'::jsonb,
  true
FROM clinics c
ON CONFLICT (category, clinic_id) DO NOTHING;

-- 4. Trigger: fires when a daily_recaps row becomes 'completed' (whether
-- inserted that way directly, or updated to it later) and it is the
-- patient's FIRST completed recap ever. If that patient was referred by
-- another patient, enqueue the reward WA message for the referrer.
CREATE OR REPLACE FUNCTION trg_referral_reward_on_first_recap()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_referrer_id uuid;
  v_referrer_name text;
  v_referrer_nickname text;
  v_referrer_phone text;
  v_new_patient_name text;
  v_template text;
  v_message text;
  v_sapaan text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  IF NEW.patient_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only act on the patient's first-ever completed recap
  IF EXISTS (
    SELECT 1 FROM daily_recaps
    WHERE patient_id = NEW.patient_id AND status = 'completed' AND id <> NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT referred_by_patient_id, full_name
  INTO v_referrer_id, v_new_patient_name
  FROM patients WHERE id = NEW.patient_id;

  IF v_referrer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name, nickname, phone
  INTO v_referrer_name, v_referrer_nickname, v_referrer_phone
  FROM patients WHERE id = v_referrer_id;

  IF v_referrer_phone IS NULL OR trim(v_referrer_phone) = '' THEN
    RETURN NEW;
  END IF;

  v_sapaan := COALESCE(NULLIF(v_referrer_nickname, ''), 'Ka ' || v_referrer_name);

  SELECT template_text INTO v_template
  FROM wa_templates
  WHERE category = 'referral_reward' AND is_enabled = true AND clinic_id = NEW.clinic_id
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_template IS NULL THEN
    v_template := 'Halo [sapaan]! 🎉 Terima kasih sudah merekomendasikan [nama_pasien_baru] untuk terapi di klinik kami. Sebagai ucapan terima kasih, [nickname] berhak mendapat promo spesial di kunjungan berikutnya 🙏';
  END IF;

  v_message := v_template;
  v_message := replace(v_message, '[sapaan]', v_sapaan);
  v_message := replace(v_message, '[nickname]', COALESCE(NULLIF(v_referrer_nickname, ''), v_referrer_name));
  v_message := replace(v_message, '[nama]', v_referrer_name);
  v_message := replace(v_message, '[nama_pasien_baru]', v_new_patient_name);

  INSERT INTO follow_up_queue (
    patient_id, phone_number, follow_up_type, source_id, source_table,
    message_content, scheduled_date, scheduled_time, status, clinic_id
  ) VALUES (
    v_referrer_id, v_referrer_phone, 'referral_reward', NEW.id, 'daily_recaps',
    v_message, CURRENT_DATE, CURRENT_TIME, 'pending', NEW.clinic_id
  )
  ON CONFLICT (patient_id, follow_up_type, scheduled_date, source_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_referral_reward_on_first_recap ON daily_recaps;
CREATE TRIGGER trg_referral_reward_on_first_recap
AFTER INSERT OR UPDATE OF status ON daily_recaps
FOR EACH ROW
EXECUTE FUNCTION trg_referral_reward_on_first_recap();
