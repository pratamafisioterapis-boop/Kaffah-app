-- SOAP-first (KHUSUS Kaffah) - tahap 3: trigger penegak aturan.
-- Semua trigger langsung keluar (RETURN NEW) bila klinik belum mengaktifkan fitur
-- atau recap_date < start_date, sehingga klinik lain & data lama tidak terpengaruh.
-- Tanpa DROP.

-- Pengiriman notifikasi (baris notifikasi + push). Tidak pernah menggagalkan transaksi.
CREATE OR REPLACE FUNCTION public.soap_first_push(p_user uuid, p_title text, p_body text, p_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  PERFORM net.http_post(
    url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-push-notification',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('user_id', p_user, 'title', p_title, 'body', p_body, 'url', p_url)
  );
EXCEPTION WHEN others THEN
  NULL;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.soap_first_notify(p_user uuid, p_title text, p_body text, p_url text, p_appointment uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF p_user IS NULL THEN
    RETURN;
  END IF;
  BEGIN
    INSERT INTO notifications (user_id, title, message, type, appointment_id)
    VALUES (p_user, p_title, p_body, 'soap_first', p_appointment);
  EXCEPTION WHEN others THEN
    NULL;
  END;
  PERFORM soap_first_push(p_user, p_title, p_body, p_url);
END;
$fn$;

-- Notifikasi ke semua owner klinik.
CREATE OR REPLACE FUNCTION public.soap_first_notify_owners(p_clinic uuid, p_title text, p_body text, p_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT u.id FROM users u WHERE u.clinic_id = p_clinic AND u.role = 'owner' AND COALESCE(u.is_active, true) LOOP
    PERFORM soap_first_notify(r.id, p_title, p_body, p_url, NULL);
  END LOOP;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- daily_recaps: persiapan (tipe pasien otomatis, waktu SOAP selesai, nominal terkunci)
-- Nama "ab_" agar jalan SEBELUM trigger diskon/paket yang sudah ada.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_ab_soap_first_prepare()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  cfg record;
  v_role text;
  v_rpc boolean;
  v_owner boolean;
  v_ids text[];
  v_locked boolean := false;
  v_is_hc boolean;
  v_hc_time text;
  v_label text;
  v_type_id uuid;
  v_calc jsonb;
  v_is_payment boolean;
  v_prior numeric;
  v_disc_type text;
  v_disc_val numeric;
  v_disc_found boolean := false;
BEGIN
  SELECT s.* INTO cfg FROM soap_first_settings s WHERE s.clinic_id = NEW.clinic_id;
  IF NOT FOUND OR NOT cfg.enabled OR NEW.recap_date IS NULL OR NEW.recap_date < cfg.start_date THEN
    RETURN NEW;
  END IF;

  v_role := get_my_role();
  v_owner := COALESCE(v_role IN ('owner', 'super_admin'), false);
  v_rpc := COALESCE(current_setting('app.soap_first_rpc', true), '') = 'on';
  NEW.soap_first_applied := true;

  IF TG_OP = 'INSERT' THEN
    IF NOT v_rpc THEN
      NEW.soap_completed_at := NULL;
      NEW.invoice_created_at := NULL;
      NEW.xtratime := false;
      NEW.incentive_zero_manual := false;
      NEW.incentive_zero_manual_reason := NULL;
      NEW.incentive_zero_manual_by := NULL;
      NEW.incentive_zero_manual_at := NULL;
      NEW.free_notified_at := NULL;
      NEW.soap_reminder1_at := NULL;
      NEW.soap_reminder2_at := NULL;
    END IF;
  ELSE
    IF NOT v_rpc THEN
      NEW.soap_completed_at := OLD.soap_completed_at;
      NEW.invoice_created_at := OLD.invoice_created_at;
      NEW.xtratime := OLD.xtratime;
      NEW.incentive_zero_manual := OLD.incentive_zero_manual;
      NEW.incentive_zero_manual_reason := OLD.incentive_zero_manual_reason;
      NEW.incentive_zero_manual_by := OLD.incentive_zero_manual_by;
      NEW.incentive_zero_manual_at := OLD.incentive_zero_manual_at;
      NEW.free_notified_at := OLD.free_notified_at;
      NEW.soap_reminder1_at := OLD.soap_reminder1_at;
      NEW.soap_reminder2_at := OLD.soap_reminder2_at;
    END IF;

    v_locked := OLD.invoice_created_at IS NOT NULL
      OR (OLD.payment_method IS NOT NULL AND OLD.payment_method <> 'Package' AND COALESCE(OLD.amount, 0) > 0)
      OR OLD.special_type = 'free';

    IF v_role IN ('admin', 'clinic_admin') AND NOT v_rpc
       AND soap_first_diag_ids(NEW.diagnosis) IS DISTINCT FROM soap_first_diag_ids(OLD.diagnosis) THEN
      RAISE EXCEPTION 'Diagnosa hanya dapat diisi terapis melalui SOAP.';
    END IF;
  END IF;

  v_ids := soap_first_diag_ids(NEW.diagnosis);
  IF COALESCE(array_length(v_ids, 1), 0) > 2 THEN
    RAISE EXCEPTION 'Maksimal 2 diagnosa per SOAP.';
  END IF;

  -- Invoice sudah terbit: nominal, diskon, dan tipe pasien terkunci.
  IF v_locked THEN
    IF NOT v_owner AND NOT v_rpc THEN
      IF NEW.amount IS DISTINCT FROM OLD.amount
         OR COALESCE(NEW.discount_value, 0) IS DISTINCT FROM COALESCE(OLD.discount_value, 0)
         OR COALESCE(NEW.discount_type, '') IS DISTINCT FROM COALESCE(OLD.discount_type, '')
         OR COALESCE(btrim(NEW.discount_label), '') IS DISTINCT FROM COALESCE(btrim(OLD.discount_label), '') THEN
        RAISE EXCEPTION 'Nominal dan diskon sudah terkunci karena invoice sudah terbit. Ajukan pengecualian ke owner.';
      END IF;
      NEW.patient_type := OLD.patient_type;
      NEW.patient_type_ids := OLD.patient_type_ids;
      NEW.special_type := OLD.special_type;
      NEW.free_reason := OLD.free_reason;
    END IF;
    RETURN NEW;
  END IF;

  -- Waktu SOAP selesai = saat diagnosa terisi DAN SOAP lengkap (S, O, A, P). Dicatat server.
  IF NEW.soap_completed_at IS NULL AND COALESCE(array_length(v_ids, 1), 0) >= 1 AND NEW.id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM medical_records m
       WHERE m.daily_recap_id = NEW.id
         AND NULLIF(btrim(COALESCE(m.subjective, '')), '') IS NOT NULL
         AND NULLIF(btrim(COALESCE(m.objective, '')), '') IS NOT NULL
         AND NULLIF(btrim(COALESCE(m.assessment, '')), '') IS NOT NULL
         AND NULLIF(btrim(COALESCE(m.plan, '')), '') IS NOT NULL
     ) THEN
    NEW.soap_completed_at := now();
  END IF;

  -- Tipe pasien otomatis dari SOAP + appointment.
  SELECT a.is_homecare, a.homecare_time_type INTO v_is_hc, v_hc_time
  FROM appointments a WHERE a.id = NEW.appointment_id;

  v_label := soap_first_derive_label(NEW.clinic_id, NEW.special_type, v_is_hc, v_hc_time, NEW.xtratime, NEW.diagnosis);
  IF v_label IS NOT NULL THEN
    SELECT o.id INTO v_type_id FROM operational_options o
    WHERE o.clinic_id = NEW.clinic_id AND o.category = 'patient_type' AND o.label = v_label LIMIT 1;
    IF v_type_id IS NOT NULL THEN
      NEW.patient_type_ids := ARRAY[v_type_id];
      NEW.patient_type := v_label;
    END IF;
  END IF;

  -- Pembayaran: kunci SOAP, nominal dari daftar harga, diskon dari daftar owner.
  v_is_payment := (NEW.payment_method IS NOT NULL AND NEW.payment_method <> 'Package') OR NEW.special_type = 'free';
  IF v_is_payment THEN
    IF NEW.special_type = 'free' AND char_length(btrim(COALESCE(NEW.free_reason, ''))) < 3 THEN
      RAISE EXCEPTION 'Alasan pasien Free wajib diisi.';
    END IF;

    v_prior := CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.amount_original, OLD.amount, 0) ELSE 0 END;
    v_calc := soap_first_compute(NEW, v_prior, NEW.package_type);
    IF v_calc ->> 'error' IS NOT NULL THEN
      RAISE EXCEPTION '%', v_calc ->> 'error';
    END IF;

    NEW.amount_original := (v_calc ->> 'total')::numeric;
    NEW.amount := NEW.amount_original;

    IF NEW.special_type = 'free' THEN
      NEW.discount_type := NULL;
      NEW.discount_value := 0;
      NEW.discount_label := NULL;
      NEW.free_notified_at := COALESCE(NEW.free_notified_at, now());
    ELSIF NEW.referral_reward_id IS NULL THEN
      IF NULLIF(btrim(COALESCE(NEW.discount_label, '')), '') IS NULL THEN
        NEW.discount_type := NULL;
        NEW.discount_value := 0;
        NEW.discount_label := NULL;
      ELSE
        SELECT o.discount_value_type, o.discount_value, true INTO v_disc_type, v_disc_val, v_disc_found
        FROM operational_options o
        WHERE o.clinic_id = NEW.clinic_id AND o.category = 'discount_type' AND COALESCE(o.is_active, true)
          AND COALESCE(o.is_referral_reward, false) = false
          AND lower(btrim(o.label)) = lower(btrim(NEW.discount_label))
        LIMIT 1;
        IF NOT COALESCE(v_disc_found, false) THEN
          RAISE EXCEPTION 'Jenis diskon "%" tidak ada dalam daftar diskon owner.', NEW.discount_label;
        END IF;
        IF v_disc_type IS NULL OR COALESCE(v_disc_val, 0) <= 0 THEN
          RAISE EXCEPTION 'Nilai diskon "%" belum diatur oleh owner.', NEW.discount_label;
        END IF;
        IF COALESCE((v_calc ->> 'is_purchase')::boolean, false) THEN
          RAISE EXCEPTION 'Paket tidak dapat diberi diskon.';
        END IF;
        IF COALESCE((v_calc ->> 'homecare')::boolean, false) AND NOT EXISTS (
          SELECT 1 FROM soap_overrides o
          WHERE o.recap_id = NEW.id AND o.kind = 'homecare_discount' AND o.status = 'approved'
        ) THEN
          RAISE EXCEPTION 'Diskon homecare memerlukan persetujuan owner.';
        END IF;
        NEW.discount_type := v_disc_type;
        NEW.discount_value := v_disc_val;
      END IF;
    END IF;

    NEW.invoice_created_at := now();
  END IF;

  RETURN NEW;
END;
$fn$;

-- Jalan SESUDAH trigger diskon lama dan SEBELUM trigger fee bank (nama "bz_"): hitung ulang nominal akhir (pembulatan Rp1.000 untuk diskon persen).
CREATE OR REPLACE FUNCTION public.trg_zz_soap_first_final()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  cfg record;
BEGIN
  IF NEW.invoice_created_at IS NULL OR NEW.amount_original IS NULL OR NOT NEW.soap_first_applied THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.invoice_created_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT s.* INTO cfg FROM soap_first_settings s WHERE s.clinic_id = NEW.clinic_id;
  IF NOT FOUND OR NOT cfg.enabled OR NEW.recap_date < cfg.start_date THEN
    RETURN NEW;
  END IF;
  IF NEW.special_type = 'free' THEN
    NEW.amount := 0;
    RETURN NEW;
  END IF;
  IF NEW.referral_reward_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.discount_type IS NULL OR COALESCE(NEW.discount_value, 0) <= 0 THEN
    NEW.amount := NEW.amount_original;
  ELSIF NEW.discount_type = 'percentage' THEN
    NEW.amount := GREATEST(round((NEW.amount_original - NEW.amount_original * LEAST(NEW.discount_value, 100) / 100) / 1000) * 1000, 0);
  ELSIF NEW.discount_type = 'nominal' THEN
    NEW.amount := GREATEST(round(NEW.amount_original - LEAST(NEW.discount_value, NEW.amount_original)), 0);
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE TRIGGER ab_soap_first_prepare
  BEFORE INSERT OR UPDATE ON public.daily_recaps
  FOR EACH ROW EXECUTE FUNCTION public.trg_ab_soap_first_prepare();

CREATE OR REPLACE TRIGGER bz_soap_first_final
  BEFORE INSERT OR UPDATE ON public.daily_recaps
  FOR EACH ROW EXECUTE FUNCTION public.trg_zz_soap_first_final();

-- Pasien Free: owner mendapat notifikasi satu kali.
CREATE OR REPLACE FUNCTION public.trg_soap_first_free_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.special_type = 'free' AND NEW.free_notified_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.free_notified_at IS NULL) THEN
    PERFORM soap_first_notify_owners(
      NEW.clinic_id,
      'Pasien FREE dicatat',
      COALESCE(NULLIF(btrim(NEW.full_name), ''), NULLIF(btrim(NEW.guest_name), ''), 'Pasien') || ' - alasan: ' || COALESCE(NEW.free_reason, '-'),
      '/owner/daily-recaps'
    );
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE TRIGGER trg_soap_first_free_notify
  AFTER INSERT OR UPDATE ON public.daily_recaps
  FOR EACH ROW WHEN (NEW.special_type = 'free' AND NEW.free_notified_at IS NOT NULL)
  EXECUTE FUNCTION public.trg_soap_first_free_notify();

-- ---------------------------------------------------------------------------
-- medical_records: SOAP oleh terapis saja, terkunci sesudah invoice, memicu penilaian "SOAP selesai".
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_soap_first_mr_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  r record;
  cfg record;
  v_role text;
  v_rpc boolean;
  v_target uuid;
  v_locked boolean;
BEGIN
  v_target := CASE WHEN TG_OP = 'DELETE' THEN OLD.daily_recap_id ELSE NEW.daily_recap_id END;
  IF v_target IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT d.clinic_id, d.recap_date, d.invoice_created_at, d.payment_method, d.amount, d.special_type INTO r
  FROM daily_recaps d WHERE d.id = v_target;
  IF NOT FOUND THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT s.* INTO cfg FROM soap_first_settings s WHERE s.clinic_id = r.clinic_id;
  IF NOT FOUND OR NOT cfg.enabled OR r.recap_date < cfg.start_date THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  v_role := get_my_role();
  v_rpc := COALESCE(current_setting('app.soap_first_rpc', true), '') = 'on';

  IF TG_OP <> 'DELETE' AND v_role IN ('admin', 'clinic_admin') AND NOT v_rpc THEN
    RAISE EXCEPTION 'SOAP harus diisi oleh terapis.';
  END IF;

  v_locked := r.invoice_created_at IS NOT NULL
    OR (r.payment_method IS NOT NULL AND r.payment_method <> 'Package' AND COALESCE(r.amount, 0) > 0)
    OR r.special_type = 'free';

  IF v_locked AND NOT v_rpc AND COALESCE(v_role IN ('owner', 'super_admin'), false) = false THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'SOAP sudah terkunci karena invoice terbit dan tidak dapat dihapus.';
    ELSIF TG_OP = 'UPDATE' AND (
      NEW.subjective IS DISTINCT FROM OLD.subjective
      OR NEW.objective IS DISTINCT FROM OLD.objective
      OR NEW.assessment IS DISTINCT FROM OLD.assessment
      OR NEW.plan IS DISTINCT FROM OLD.plan
    ) THEN
      RAISE EXCEPTION 'SOAP sudah terkunci karena invoice terbit. Gunakan jalur Revisi SOAP.';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$fn$;

CREATE OR REPLACE TRIGGER aa_soap_first_mr_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.trg_soap_first_mr_guard();

-- Setelah SOAP tersimpan: sentuh recap agar waktu "SOAP selesai" dicatat server.
CREATE OR REPLACE FUNCTION public.trg_soap_first_mr_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.daily_recap_id IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE daily_recaps d
  SET updated_at = now()
  WHERE d.id = NEW.daily_recap_id
    AND d.soap_completed_at IS NULL
    AND d.invoice_created_at IS NULL
    AND EXISTS (
      SELECT 1 FROM soap_first_settings s
      WHERE s.clinic_id = d.clinic_id AND s.enabled AND d.recap_date >= s.start_date
    );
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE TRIGGER trg_soap_first_mr_touch
  AFTER INSERT OR UPDATE ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.trg_soap_first_mr_touch();

-- ---------------------------------------------------------------------------
-- package_tracking: perpanjangan masa aktif paket di Kaffah wajib persetujuan owner.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_soap_first_package_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  cfg record;
  v_clinic uuid;
  v_role text;
BEGIN
  IF NEW.end_date IS NOT DISTINCT FROM OLD.end_date
     AND NEW.extended_until IS NOT DISTINCT FROM OLD.extended_until THEN
    RETURN NEW;
  END IF;
  IF COALESCE(current_setting('app.soap_first_rpc', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  v_role := get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'clinic_admin', 'therapist') THEN
    RETURN NEW;
  END IF;
  v_clinic := COALESCE(NEW.clinic_id, (SELECT p.clinic_id FROM patients p WHERE p.id = NEW.patient_id));
  SELECT s.* INTO cfg FROM soap_first_settings s WHERE s.clinic_id = v_clinic;
  IF NOT FOUND OR NOT cfg.enabled THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Perpanjangan masa aktif paket harus disetujui owner. Ajukan pengecualian terlebih dahulu.';
END;
$fn$;

CREATE OR REPLACE TRIGGER aa_soap_first_package_guard
  BEFORE UPDATE ON public.package_tracking
  FOR EACH ROW EXECUTE FUNCTION public.trg_soap_first_package_guard();

REVOKE ALL ON FUNCTION public.soap_first_push(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.soap_first_notify(uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.soap_first_notify_owners(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_ab_soap_first_prepare() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_zz_soap_first_final() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_soap_first_free_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_soap_first_mr_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_soap_first_mr_touch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_soap_first_package_guard() FROM PUBLIC, anon, authenticated;
