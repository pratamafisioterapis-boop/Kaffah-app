-- Jalankan di Supabase > SQL Editor (satu kali). Menerbitkan kode reward saat pasien disimpan dengan referral.
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
