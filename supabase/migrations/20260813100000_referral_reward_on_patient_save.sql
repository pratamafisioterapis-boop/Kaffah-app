-- Move the referral reward trigger from "new patient's first completed
-- therapy session" to "the moment the new patient is saved with a referrer
-- selected" (insert, or an edit that adds/changes the referrer). This makes
-- the reward message for the referring patient appear in the Reward tab
-- immediately after admin fills in "Direferensikan oleh Pasien" and clicks
-- Simpan, instead of waiting for a completed daily_recap.

DROP TRIGGER IF EXISTS trg_referral_reward_on_first_recap ON daily_recaps;
DROP FUNCTION IF EXISTS trg_referral_reward_on_first_recap();

CREATE OR REPLACE FUNCTION trg_referral_reward_on_patient_referral()
RETURNS trigger
LANGUAGE plpgsql
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
  v_hari_berlaku text;
  v_bulan_berlaku text;
  v_masa_berlaku text;
BEGIN
  IF NEW.referred_by_patient_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only fire when the referral is newly set (covers both a fresh insert
  -- with a referrer already chosen, and an edit that adds/changes one).
  IF TG_OP = 'UPDATE' AND OLD.referred_by_patient_id IS NOT DISTINCT FROM NEW.referred_by_patient_id THEN
    RETURN NEW;
  END IF;

  SELECT full_name, nickname, phone
  INTO v_referrer_name, v_referrer_nickname, v_referrer_phone
  FROM patients WHERE id = NEW.referred_by_patient_id;

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
  v_message := replace(v_message, '[nama_pasien_baru]', NEW.full_name);
  v_message := replace(v_message, '[masa_berlaku]', v_masa_berlaku);

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

DROP TRIGGER IF EXISTS trg_referral_reward_on_patient_referral ON patients;
CREATE TRIGGER trg_referral_reward_on_patient_referral
AFTER INSERT OR UPDATE OF referred_by_patient_id ON patients
FOR EACH ROW
EXECUTE FUNCTION trg_referral_reward_on_patient_referral();

-- Backfill: generate the reward message now for any patient that already
-- has a referrer set but never produced a reward under either mechanism
-- (old first-recap trigger or this new one). Re-triggers the new function
-- above via a null-then-restore update so the rendering logic isn't
-- duplicated here.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.id, p.referred_by_patient_id
    FROM patients p
    WHERE p.referred_by_patient_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM follow_up_queue fq
        WHERE fq.follow_up_type = 'referral_reward'
          AND fq.patient_id = p.referred_by_patient_id
          AND (
            (fq.source_table = 'patients' AND fq.source_id = p.id)
            OR (fq.source_table = 'daily_recaps' AND fq.source_id IN (
                  SELECT dr.id FROM daily_recaps dr WHERE dr.patient_id = p.id
                ))
          )
      )
  LOOP
    UPDATE patients SET referred_by_patient_id = NULL WHERE id = r.id;
    UPDATE patients SET referred_by_patient_id = r.referred_by_patient_id WHERE id = r.id;
  END LOOP;
END $$;
