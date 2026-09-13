-- Add a [waktu] placeholder to the referral_reward WhatsApp template that
-- renders "Selamat Pagi/Siang/Sore/Malam" based on the current time (WITA)
-- at the moment the reward message is composed (same moment as every other
-- placeholder in this trigger, e.g. [tanggal]/[jam] elsewhere in the app).

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
  v_waktu text;
  v_jam_now int;
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

  v_jam_now := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Asia/Makassar'))::int;
  v_waktu := CASE
    WHEN v_jam_now >= 4 AND v_jam_now < 11 THEN 'Selamat Pagi'
    WHEN v_jam_now >= 11 AND v_jam_now < 15 THEN 'Selamat Siang'
    WHEN v_jam_now >= 15 AND v_jam_now < 18 THEN 'Selamat Sore'
    ELSE 'Selamat Malam'
  END;

  SELECT template_text INTO v_template
  FROM wa_templates
  WHERE category = 'referral_reward' AND is_enabled = true AND clinic_id = NEW.clinic_id
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_template IS NULL THEN
    v_template := '[waktu] [sapaan]! 🎉 Terima kasih sudah merekomendasikan [nama_pasien_baru] untuk terapi di klinik kami. Sebagai ucapan terima kasih, [nickname] berhak mendapat promo spesial di kunjungan berikutnya 🙏';
  END IF;

  v_message := v_template;
  v_message := replace(v_message, '[waktu]', v_waktu);
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

-- Update the still-default (un-customized) templates so every clinic that
-- hasn't edited theirs yet also gets the dynamic greeting.
UPDATE wa_templates
SET template_text = replace(template_text, 'Halo [sapaan]!', '[waktu] [sapaan]!'),
    updated_at = timezone('utc'::text, now())
WHERE category = 'referral_reward'
  AND template_text = 'Halo [sapaan]! 🎉 Terima kasih banyak sudah merekomendasikan [nama_pasien_baru] untuk terapi di klinik kami. Sebagai ucapan terima kasih, [nickname] berhak mendapat promo spesial di kunjungan berikutnya. Silakan hubungi kami untuk klaim promonya ya 🙏';

-- Kaffah Physiotherapy's own customized copy (as drafted by the owner) with
-- the same swap applied.
UPDATE wa_templates
SET template_text = '🎁 Reward Referral Kaffah Physiotherapy

[waktu] [sapaan]! 👋

Terima kasih sudah merekomendasikan [nama_pasien_baru] untuk melakukan terapi di Kaffah Physiotherapy. 🙏

Sebagai bentuk apresiasi, [nickname] mendapatkan reward referral berupa potongan Rp100.000 untuk kunjungan terapi berikutnya. 🎉

✨ Referral Reward: Rp100.000 OFF

Untuk klaim reward, silakan hubungi admin Kaffah Physiotherapy ya.

Terima kasih sudah ikut membantu lebih banyak orang mendapatkan layanan fisioterapi yang tepat. 💙',
    placeholders = '["sapaan","nickname","nama","nama_pasien_baru","waktu"]'::jsonb,
    updated_at = timezone('utc'::text, now())
WHERE category = 'referral_reward'
  AND clinic_id = (SELECT id FROM clinics WHERE name = 'Kaffah Physiotherapy' LIMIT 1);
