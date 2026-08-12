-- Add a [masa_berlaku] placeholder to the referral_reward WhatsApp template:
-- renders the reward's expiry date (30 days from when the message is
-- composed) as "Hari, DD Bulan YYYY" in Indonesian, e.g. "Kamis, 11
-- September 2026".

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
  v_berlaku_date date;
  v_hari_berlaku text;
  v_bulan_berlaku text;
  v_masa_berlaku text;
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

  v_berlaku_date := ((NOW() AT TIME ZONE 'Asia/Makassar')::date) + 30;

  v_hari_berlaku := CASE EXTRACT(DOW FROM v_berlaku_date)
    WHEN 0 THEN 'Minggu' WHEN 1 THEN 'Senin' WHEN 2 THEN 'Selasa'
    WHEN 3 THEN 'Rabu' WHEN 4 THEN 'Kamis' WHEN 5 THEN 'Jumat' WHEN 6 THEN 'Sabtu'
  END;

  v_bulan_berlaku := CASE EXTRACT(MONTH FROM v_berlaku_date)
    WHEN 1 THEN 'Januari' WHEN 2 THEN 'Februari' WHEN 3 THEN 'Maret'
    WHEN 4 THEN 'April' WHEN 5 THEN 'Mei' WHEN 6 THEN 'Juni'
    WHEN 7 THEN 'Juli' WHEN 8 THEN 'Agustus' WHEN 9 THEN 'September'
    WHEN 10 THEN 'Oktober' WHEN 11 THEN 'November' WHEN 12 THEN 'Desember'
  END;

  v_masa_berlaku := v_hari_berlaku || ', ' || EXTRACT(DAY FROM v_berlaku_date)::int
    || ' ' || v_bulan_berlaku || ' ' || EXTRACT(YEAR FROM v_berlaku_date)::int;

  SELECT template_text INTO v_template
  FROM wa_templates
  WHERE category = 'referral_reward' AND is_enabled = true AND clinic_id = NEW.clinic_id
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_template IS NULL THEN
    v_template := '[waktu] [sapaan]! 🎉 Terima kasih sudah merekomendasikan [nama_pasien_baru] untuk terapi di klinik kami. Sebagai ucapan terima kasih, [nickname] berhak mendapat promo spesial di kunjungan berikutnya (berlaku hingga [masa_berlaku]) 🙏';
  END IF;

  v_message := v_template;
  v_message := replace(v_message, '[waktu]', v_waktu);
  v_message := replace(v_message, '[sapaan]', v_sapaan);
  v_message := replace(v_message, '[nickname]', COALESCE(NULLIF(v_referrer_nickname, ''), v_referrer_name));
  v_message := replace(v_message, '[nama]', v_referrer_name);
  v_message := replace(v_message, '[nama_pasien_baru]', v_new_patient_name);
  v_message := replace(v_message, '[masa_berlaku]', v_masa_berlaku);

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

-- Update the still-default (un-customized) templates to mention the validity.
UPDATE wa_templates
SET template_text = replace(
      template_text,
      'berikutnya. Silakan hubungi kami untuk klaim promonya ya 🙏',
      'berikutnya (berlaku hingga [masa_berlaku]). Silakan hubungi kami untuk klaim promonya ya 🙏'
    ),
    placeholders = '["sapaan","nickname","nama","nama_pasien_baru","waktu","masa_berlaku"]'::jsonb,
    updated_at = timezone('utc'::text, now())
WHERE category = 'referral_reward'
  AND template_text LIKE '%berikutnya. Silakan hubungi kami untuk klaim promonya ya 🙏%';

-- Kaffah Physiotherapy's own customized copy: add a validity line right
-- under the reward amount.
UPDATE wa_templates
SET template_text = replace(
      template_text,
      '✨ Referral Reward: Rp100.000 OFF',
      '✨ Referral Reward: Rp100.000 OFF' || E'\n' || '⏳ Berlaku hingga [masa_berlaku]'
    ),
    placeholders = '["sapaan","nickname","nama","nama_pasien_baru","waktu","masa_berlaku"]'::jsonb,
    updated_at = timezone('utc'::text, now())
WHERE category = 'referral_reward'
  AND clinic_id = (SELECT id FROM clinics WHERE name = 'Kaffah Physiotherapy' LIMIT 1)
  AND template_text LIKE '%✨ Referral Reward: Rp100.000 OFF%'
  AND template_text NOT LIKE '%[masa_berlaku]%';
