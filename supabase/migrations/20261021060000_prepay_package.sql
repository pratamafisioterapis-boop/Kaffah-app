-- Bayar di muka untuk paket homecare dan paket "RU" (appointment sudah ada, terapi belum).
--
-- Alur: admin menekan "Bayar di muka" pada appointment mendatang -> prepay_package()
-- membuat recap lebih awal (recap_date = tanggal terapi) lalu mengisi pembayaran lewat
-- jalur trigger yang sama dengan pembayaran biasa. Hasilnya: invoice terbit hari ini,
-- revenue_date = hari ini, paket aktif, tetapi sesi baru terhitung "terpakai" pada hari
-- terapi. recap_date tetap tanggal terapi (insentif, SOAP, daftar kunjungan).
--
-- Refund: kembali penuh, hanya owner (refund_prepaid_package). Masa berlaku paket
-- dihitung dari sesi pertama (tanggal terapi), bukan tanggal bayar.

-- 1. Penanda recap berbayar di muka -----------------------------------------------
ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS prepaid_at timestamptz;

-- 2. soap_first_compute: mode bayar di muka melewati kunci SOAP dan TTV ------------
CREATE OR REPLACE FUNCTION public.soap_first_compute(
  d public.daily_recaps,
  p_prior_amount numeric,
  p_package_label text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  cfg record;
  v_is_hc boolean;
  v_hc_time text;
  v_label text;
  v_type_id uuid;
  v_hc boolean;
  v_followup boolean;
  v_soap_done boolean;
  v_unlock boolean;
  v_needs_soap boolean;
  v_prepay boolean := COALESCE(current_setting('app.prepay', true), '') = 'on';
  v_pkg_label text;
  v_pkg_sessions integer;
  v_pkg_price numeric;
  v_is_purchase boolean := false;
  v_is_ru boolean := false;
  v_pkg_hc boolean := false;
  v_is_hc_pkg boolean := false;
  v_base numeric;
  v_surcharge numeric := 0;
  v_total numeric;
  v_err text;
  v_adjust numeric;
BEGIN
  SELECT * INTO cfg FROM soap_first_settings s WHERE s.clinic_id = d.clinic_id;
  IF NOT FOUND OR NOT cfg.enabled OR d.recap_date < cfg.start_date THEN
    RETURN jsonb_build_object('active', false);
  END IF;

  SELECT a.is_homecare, a.homecare_time_type INTO v_is_hc, v_hc_time
  FROM appointments a WHERE a.id = d.appointment_id;

  v_hc := COALESCE(v_is_hc, false);
  v_followup := d.package_tracking_id IS NOT NULL AND COALESCE(p_prior_amount, 0) = 0;
  v_soap_done := d.soap_completed_at IS NOT NULL;
  v_unlock := EXISTS (
    SELECT 1 FROM soap_overrides o
    WHERE o.recap_id = d.id AND o.kind = 'payment_unlock' AND o.status = 'approved'
  );
  -- Bayar di muka: pembayaran terjadi sebelum terapi, jadi SOAP/TTV belum mungkin ada.
  v_needs_soap := (NOT v_hc) AND (NOT v_followup) AND (NOT v_prepay);

  v_label := soap_first_derive_label(d.clinic_id, d.special_type, v_hc, v_hc_time, d.xtratime, d.diagnosis);
  IF v_label IS NOT NULL THEN
    SELECT o.id INTO v_type_id FROM operational_options o
    WHERE o.clinic_id = d.clinic_id AND o.category = 'patient_type' AND o.label = v_label LIMIT 1;
  END IF;

  IF p_package_label IS NOT NULL AND lower(btrim(p_package_label)) NOT IN ('', 'reguler') THEN
    SELECT o.label, o.session_count, o.price, COALESCE(o.is_homecare, false) INTO v_pkg_label, v_pkg_sessions, v_pkg_price, v_pkg_hc
    FROM operational_options o
    WHERE o.clinic_id = d.clinic_id AND o.category = 'tipe_paket' AND lower(o.label) = lower(btrim(p_package_label))
    LIMIT 1;
    IF COALESCE(v_pkg_sessions, 0) > 1 AND d.package_tracking_id IS NULL THEN
      v_is_purchase := true;
      -- Paket RU: boleh untuk diagnosa apa pun, tanpa tambahan 2 keluhan.
      v_is_ru := v_pkg_label ILIKE '% RU';
      -- Paket homecare: harga flat, tanpa syarat jumlah keluhan.
      v_is_hc_pkg := v_pkg_hc;
    END IF;
  END IF;

  IF v_needs_soap AND NOT v_soap_done AND NOT v_unlock THEN
    v_err := 'SOAP belum diisi oleh terapis. Pembayaran terkunci sampai SOAP selesai.';
  ELSIF NOT v_prepay
        AND d.clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid
        AND NOT EXISTS (SELECT 1 FROM recap_vital_signs rv WHERE rv.recap_id = d.id) THEN
    v_err := 'TTV (tanda vital) belum diisi. Isi TTV di detail recap sebelum invoice dapat dikirim.';
  ELSIF d.special_type = 'free' THEN
    v_base := 0;
  ELSIF v_is_hc_pkg AND NOT v_hc THEN
    v_err := 'Paket homecare hanya untuk appointment homecare.';
  ELSIF v_is_ru OR v_is_hc_pkg THEN
    IF v_pkg_price IS NULL THEN
      v_err := 'Harga paket "' || v_pkg_label || '" belum diatur owner.';
    ELSE
      v_base := v_pkg_price;
    END IF;
  ELSIF v_label IS NULL THEN
    IF v_hc THEN
      v_err := 'Pilih homecare di dalam atau di luar jam kerja pada appointment terlebih dahulu.';
    ELSE
      v_err := 'Tipe pasien belum dapat ditentukan karena diagnosa belum diisi terapis.';
    END IF;
  ELSIF v_is_purchase THEN
    IF v_label NOT IN ('NORMAL', 'DUA KELUHAN') THEN
      v_err := 'Paket hanya untuk pasien 1 atau 2 keluhan.';
    ELSIF v_pkg_price IS NULL THEN
      v_err := 'Harga paket "' || v_pkg_label || '" belum diatur owner.';
    ELSE
      v_base := v_pkg_price;
      IF v_label = 'DUA KELUHAN' THEN
        v_surcharge := cfg.two_complaint_package_surcharge * v_pkg_sessions;
      END IF;
    END IF;
  ELSE
    SELECT p.price INTO v_base FROM clinic_service_prices p
    WHERE p.clinic_id = d.clinic_id AND p.patient_type_id = v_type_id;
    IF v_base IS NULL THEN
      v_err := 'Harga untuk tipe "' || v_label || '" belum diatur owner.';
    END IF;
  END IF;

  -- Penyesuaian nominal yang sudah disetujui owner.
  SELECT NULLIF(o.payload ->> 'amount', '')::numeric INTO v_adjust
  FROM soap_overrides o
  WHERE o.recap_id = d.id AND o.kind = 'amount_adjust' AND o.status = 'approved'
  ORDER BY o.decided_at DESC NULLS LAST LIMIT 1;
  IF v_adjust IS NOT NULL AND v_err IS NULL THEN
    v_base := v_adjust;
    v_surcharge := 0;
  END IF;

  v_total := CASE WHEN v_base IS NULL THEN NULL ELSE v_base + v_surcharge END;

  RETURN jsonb_build_object(
    'active', true,
    'error', v_err,
    'soap_done', v_soap_done,
    'followup', v_followup,
    'homecare', v_hc,
    'needs_soap', v_needs_soap,
    'unlocked_by_override', v_unlock,
    'type_label', v_label,
    'type_id', v_type_id,
    'is_purchase', v_is_purchase,
    'package_sessions', v_pkg_sessions,
    'base', v_base,
    'surcharge', v_surcharge,
    'total', v_total,
    'package_allowed', (COALESCE(v_label IN ('NORMAL', 'DUA KELUHAN'), false) OR v_is_ru OR v_is_hc_pkg)
  );
END;
$fn$;

-- 3. Trigger kunci: tipe pasien recap berbayar di muka ditentukan setelah SOAP -------
-- (paket RU non-homecare: diagnosa belum ada saat bayar, jadi tipe pasien baru bisa
-- diturunkan setelah terapis mengisi SOAP walau invoice sudah terbit.)
CREATE OR REPLACE FUNCTION public.trg_ab_soap_first_prepare()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_manual boolean := false;
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

    -- Recap berbayar di muka yang tipe pasiennya belum bisa ditentukan saat bayar:
    -- turunkan dari SOAP begitu terapis mengisi diagnosa. Nominal tidak berubah.
    IF OLD.prepaid_at IS NOT NULL
       AND lower(COALESCE(OLD.patient_type, '')) IN ('', 'registered', 'guest') THEN
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
    END IF;

    RETURN NEW;
  END IF;

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
          -- Diskon manual (mis. Keluarga): nilai diinput admin, wajib disetujui owner.
          SELECT o.payload ->> 'discount_type', NULLIF(o.payload ->> 'discount_value', '')::numeric INTO v_disc_type, v_disc_val
          FROM soap_overrides o
          WHERE o.recap_id = NEW.id AND o.kind = 'manual_discount' AND o.status = 'approved'
          ORDER BY o.decided_at DESC NULLS LAST LIMIT 1;
          IF v_disc_type IS NULL OR COALESCE(v_disc_val, 0) <= 0 THEN
            RAISE EXCEPTION 'Diskon "%" diinput manual dan wajib disetujui owner. Ajukan persetujuan terlebih dahulu.', NEW.discount_label;
          END IF;
          v_manual := true;
        END IF;
        IF COALESCE((v_calc ->> 'is_purchase')::boolean, false) THEN
          RAISE EXCEPTION 'Paket tidak dapat diberi diskon.';
        END IF;
        IF COALESCE((v_calc ->> 'homecare')::boolean, false) AND NOT v_manual AND NOT EXISTS (
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
$function$;

-- 4. Sesi paket "terpakai" baru dihitung pada/setelah tanggal terapi ----------------
-- (recap berbayar di muka bertanggal masa depan belum memotong kuota.)
CREATE OR REPLACE FUNCTION public.recalculate_package_sessions(p_package_id uuid, p_reference_date date DEFAULT CURRENT_DATE)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_total_sessions     integer;
    v_used               integer;
    v_remaining          integer;
    v_status             text;
    v_end_date           date;
    v_extended_until     date;
    v_current_status     text;
    v_effective_end_date date;
BEGIN
    SELECT total_sessions, end_date, extended_until, status
    INTO v_total_sessions, v_end_date, v_extended_until, v_current_status
    FROM package_tracking
    WHERE id = p_package_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Hitung recap tertaut yang tanggal terapinya sudah tiba (recap masa depan,
    -- mis. berbayar di muka, belum memotong kuota).
    SELECT COUNT(*)
    INTO v_used
    FROM daily_recaps
    WHERE package_tracking_id = p_package_id
      AND recap_date <= (now() AT TIME ZONE 'Asia/Makassar')::date;

    v_remaining := GREATEST(v_total_sessions - v_used, 0);

    -- Untuk diperpanjang dan pending, jangan ubah status KECUALI diperpanjang
    -- yang sesinya sudah habis - itu harus bisa otomatis jadi 'selesai'.
    IF v_current_status IN ('diperpanjang', 'pending') THEN
        IF v_current_status = 'diperpanjang' AND v_remaining = 0 THEN
            UPDATE package_tracking
            SET
                sessions_used      = v_used,
                sessions_remaining = v_remaining,
                status             = 'selesai',
                updated_at         = now()
            WHERE id = p_package_id;
        ELSE
            UPDATE package_tracking
            SET
                sessions_used      = v_used,
                sessions_remaining = v_remaining,
                updated_at         = now()
            WHERE id = p_package_id;
        END IF;
        RETURN;
    END IF;

    v_effective_end_date := COALESCE(v_extended_until, v_end_date);

    -- Prioritas: selesai > expired > aktif
    IF v_remaining = 0 THEN
        v_status := 'selesai';
    ELSIF v_effective_end_date IS NOT NULL AND v_effective_end_date < CURRENT_DATE THEN
        v_status := 'expired';
    ELSE
        v_status := 'aktif';
    END IF;

    UPDATE package_tracking
    SET
        sessions_used      = v_used,
        sessions_remaining = v_remaining,
        status             = v_status,
        updated_at         = now()
    WHERE id = p_package_id;

END;
$function$;

-- Hitung ulang sesi paket yang recap berbayar-di-mukanya jatuh tempo hari ini.
CREATE OR REPLACE FUNCTION public.recalc_prepaid_package_sessions()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT d.package_tracking_id AS id
    FROM daily_recaps d
    WHERE d.prepaid_at IS NOT NULL
      AND d.package_tracking_id IS NOT NULL
      AND d.recap_date BETWEEN ((now() AT TIME ZONE 'Asia/Makassar')::date - 1)
                           AND (now() AT TIME ZONE 'Asia/Makassar')::date
  LOOP
    PERFORM recalculate_package_sessions(r.id);
  END LOOP;
END;
$function$;

-- 00:05 WITA = 16:05 UTC (sebelum generate_daily_recaps_midnight pukul 16:10 UTC).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recalc-prepaid-package-sessions') THEN
    PERFORM cron.schedule('recalc-prepaid-package-sessions', '5 16 * * *', 'SELECT public.recalc_prepaid_package_sessions();');
  END IF;
END $$;

-- 5. Pengaman appointment <-> recap berbayar di muka --------------------------------
-- 5. Saat hari terapi tiba, appointment di-upsert ke recap: jangan timpa data bayar.
CREATE OR REPLACE FUNCTION public.trg_appointment_confirmed_to_recap()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_therapist_name  text;
  v_clinic_id       uuid;
  v_pkg_tracking_id uuid;
  v_package_type    text;
  v_recap_date      date;
  v_today           date;
BEGIN

  v_recap_date := (NEW.appointment_date AT TIME ZONE 'Asia/Makassar')::date;
  v_today      := (NOW() AT TIME ZONE 'Asia/Makassar')::date;

  IF NEW.status NOT IN ('confirmed', 'rescheduled') THEN
    RETURN NEW;
  END IF;

  IF v_recap_date > v_today THEN
    RETURN NEW;
  END IF;

  -- Kalau recap utk appointment ini sudah ada, sudah ke-link paket, punya pasien
  -- yang sama, DAN tanggal recap-nya tidak berubah (reschedule cuma geser jam /
  -- ganti terapis di hari yang sama) -- pertahankan link itu, jangan dicari ulang.
  -- Kalau tanggalnya beneran pindah hari, biarkan dicari ulang di bawah karena
  -- rentang validitas paket bisa beda utk tanggal baru.
  SELECT dr.package_tracking_id, dr.package_type
  INTO v_pkg_tracking_id, v_package_type
  FROM daily_recaps dr
  WHERE dr.appointment_id = NEW.id
    AND dr.patient_id IS NOT DISTINCT FROM NEW.patient_id
    AND dr.recap_date = v_recap_date;

  IF v_pkg_tracking_id IS NULL AND NEW.patient_id IS NOT NULL THEN
    SELECT pt.id, pt.package_name
    INTO v_pkg_tracking_id, v_package_type
    FROM package_tracking pt
    WHERE pt.patient_id = NEW.patient_id
      AND pt.status = 'aktif'
      AND pt.sessions_remaining > 0
      AND v_recap_date BETWEEN pt.start_date
      AND COALESCE(pt.extended_until, pt.end_date)
    ORDER BY pt.start_date DESC
    LIMIT 1;
  END IF;

  IF v_pkg_tracking_id IS NULL THEN
    v_package_type := NULL;
  END IF;

  -- ambil nama therapist + clinic_id
  SELECT name, clinic_id
  INTO v_therapist_name, v_clinic_id
  FROM physiotherapists
  WHERE id = NEW.therapist_id;

  -- fallback kalau clinic_id therapist kosong
  IF v_clinic_id IS NULL THEN
    SELECT id INTO v_clinic_id FROM clinics LIMIT 1;
  END IF;

  INSERT INTO daily_recaps (
    id,
    appointment_id,
    patient_id,
    therapist_id,
    therapist_name,
    patient_type,
    recap_date,
    created_at,
    updated_at,
    status,
    package_tracking_id,
    package_type,
    payment_method,
    guest_name,
    guest_phone,
    clinic_id
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    CASE WHEN NEW.patient_id IS NOT NULL THEN NEW.patient_id ELSE NULL END,
    NEW.therapist_id,
    v_therapist_name,
    CASE WHEN NEW.patient_id IS NOT NULL THEN 'registered' ELSE 'guest' END,
    v_recap_date,
    NOW(),
    NOW(),
    NEW.status,
    v_pkg_tracking_id,
    v_package_type,
    CASE WHEN v_pkg_tracking_id IS NOT NULL THEN 'Package' ELSE NULL END,
    NEW.guest_name,
    NEW.guest_phone,
    v_clinic_id
  )
  ON CONFLICT (appointment_id)
  DO UPDATE SET
    therapist_id      = EXCLUDED.therapist_id,
    therapist_name     = EXCLUDED.therapist_name,
    guest_name        = EXCLUDED.guest_name,
    guest_phone       = EXCLUDED.guest_phone,
    status            = EXCLUDED.status,
    updated_at        = NOW(),
    package_tracking_id = CASE WHEN daily_recaps.prepaid_at IS NOT NULL
      THEN daily_recaps.package_tracking_id ELSE EXCLUDED.package_tracking_id END,
    package_type      = CASE WHEN daily_recaps.prepaid_at IS NOT NULL
      THEN daily_recaps.package_type ELSE EXCLUDED.package_type END,
    payment_method    = CASE
      WHEN daily_recaps.prepaid_at IS NOT NULL THEN daily_recaps.payment_method
      WHEN EXCLUDED.package_tracking_id IS NOT NULL THEN 'Package'
      ELSE NULL
    END,
    clinic_id         = COALESCE(daily_recaps.clinic_id, EXCLUDED.clinic_id);

  RETURN NEW;
END;
$function$;

-- 6. Fungsi bayar di muka -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prepay_package(
  p_appointment_id uuid,
  p_package_label text,
  p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_role text := get_my_role();
  v_clinic uuid := get_my_clinic_id();
  a appointments;
  v_today date := (now() AT TIME ZONE 'Asia/Makassar')::date;
  v_appt_date date;
  v_pkg operational_options;
  v_pm_label text;
  v_pm_bank uuid;
  v_therapist_name text;
  v_recap_id uuid := gen_random_uuid();
  r daily_recaps;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin', 'clinic_admin', 'owner', 'super_admin') THEN
    RAISE EXCEPTION 'Anda tidak punya izin untuk mencatat pembayaran di muka.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO a FROM appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment tidak ditemukan.';
  END IF;
  IF v_role <> 'super_admin' AND a.clinic_id IS DISTINCT FROM v_clinic THEN
    RAISE EXCEPTION 'Appointment bukan milik klinik Anda.' USING ERRCODE = '42501';
  END IF;

  IF a.status NOT IN ('confirmed', 'rescheduled') THEN
    RAISE EXCEPTION 'Appointment harus berstatus terkonfirmasi.';
  END IF;
  IF a.patient_id IS NULL THEN
    RAISE EXCEPTION 'Paket hanya untuk pasien terdaftar (bukan tamu).';
  END IF;

  v_appt_date := (a.appointment_date AT TIME ZONE 'Asia/Makassar')::date;
  IF v_appt_date <= v_today THEN
    RAISE EXCEPTION 'Appointment ini hari ini atau sudah lewat. Catat pembayaran lewat Daily Recap seperti biasa.';
  END IF;

  IF EXISTS (SELECT 1 FROM daily_recaps WHERE appointment_id = a.id) THEN
    RAISE EXCEPTION 'Appointment ini sudah memiliki recap.';
  END IF;

  SELECT * INTO v_pkg FROM operational_options o
  WHERE o.clinic_id = a.clinic_id AND o.category = 'tipe_paket'
    AND COALESCE(o.is_active, true)
    AND lower(o.label) = lower(btrim(p_package_label))
  LIMIT 1;
  IF NOT FOUND OR COALESCE(v_pkg.session_count, 0) <= 1 THEN
    RAISE EXCEPTION 'Paket "%" tidak ditemukan.', p_package_label;
  END IF;
  IF v_pkg.price IS NULL THEN
    RAISE EXCEPTION 'Harga paket "%" belum diatur owner.', v_pkg.label;
  END IF;
  IF COALESCE(v_pkg.is_homecare, false) THEN
    IF NOT COALESCE(a.is_homecare, false) THEN
      RAISE EXCEPTION 'Paket homecare hanya untuk appointment homecare.';
    END IF;
  ELSIF v_pkg.label NOT ILIKE '% RU' THEN
    RAISE EXCEPTION 'Paket "%" belum bisa dibayar di muka (hanya paket homecare dan paket RU).', v_pkg.label;
  END IF;

  IF EXISTS (
    SELECT 1 FROM package_tracking pt
    WHERE pt.patient_id = a.patient_id AND pt.status IN ('aktif', 'pending', 'diperpanjang')
  ) THEN
    RAISE EXCEPTION 'Pasien masih memiliki paket aktif / pending.';
  END IF;

  SELECT o.label, o.bank_account_id INTO v_pm_label, v_pm_bank
  FROM operational_options o
  WHERE o.clinic_id = a.clinic_id AND o.category = 'payment_method'
    AND COALESCE(o.is_active, true)
    AND lower(o.label) = lower(btrim(p_payment_method))
    AND lower(o.label) <> 'package'
  LIMIT 1;
  IF v_pm_label IS NULL THEN
    RAISE EXCEPTION 'Metode pembayaran "%" tidak valid.', p_payment_method;
  END IF;

  SELECT name INTO v_therapist_name FROM physiotherapists WHERE id = a.therapist_id;

  PERFORM set_config('app.soap_first_rpc', 'on', true);
  PERFORM set_config('app.prepay', 'on', true);

  -- Recap lebih awal (sama seperti recap hari-H), lalu isi pembayaran lewat UPDATE
  -- supaya semua trigger (invoice, paket, revenue_date) jalan seperti biasa.
  INSERT INTO daily_recaps (
    id, appointment_id, patient_id, therapist_id, therapist_name, patient_type,
    recap_date, created_at, updated_at, status, guest_name, guest_phone, clinic_id
  ) VALUES (
    v_recap_id, a.id, a.patient_id, a.therapist_id, v_therapist_name, 'registered',
    v_appt_date, now(), now(), a.status, a.guest_name, a.guest_phone, a.clinic_id
  );

  UPDATE daily_recaps
  SET package_type = v_pkg.label,
      payment_method = v_pm_label,
      bank_account_id = v_pm_bank,
      amount = v_pkg.price,
      prepaid_at = now(),
      updated_at = now()
  WHERE id = v_recap_id
  RETURNING * INTO r;

  PERFORM set_config('app.prepay', 'off', true);
  PERFORM set_config('app.soap_first_rpc', 'off', true);

  IF r.invoice_created_at IS NULL OR r.package_tracking_id IS NULL THEN
    RAISE EXCEPTION 'Pembayaran di muka gagal dicatat (invoice/paket tidak terbentuk).';
  END IF;

  UPDATE package_tracking SET clinic_id = a.clinic_id
  WHERE id = r.package_tracking_id AND clinic_id IS NULL;

  RETURN jsonb_build_object(
    'recap_id', r.id,
    'package_tracking_id', r.package_tracking_id,
    'amount', r.amount,
    'payment_method', r.payment_method,
    'receipt_number', r.receipt_number,
    'paid_at', r.invoice_created_at,
    'therapy_date', r.recap_date
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.prepay_package(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepay_package(uuid, text, text) TO authenticated;

-- 7. Refund (kembali penuh, hanya owner) ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.prepay_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  recap_id uuid,
  appointment_id uuid,
  patient_id uuid,
  patient_name text,
  package_name text,
  amount numeric NOT NULL,
  payment_method text,
  receipt_number text,
  paid_at timestamptz,
  therapy_date date,
  reason text NOT NULL,
  refunded_by uuid,
  refunded_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb
);

CREATE INDEX IF NOT EXISTS idx_prepay_refunds_clinic ON public.prepay_refunds (clinic_id, refunded_at DESC);

ALTER TABLE public.prepay_refunds ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'prepay_refunds' AND policyname = 'Staff read own clinic prepay refunds') THEN
    CREATE POLICY "Staff read own clinic prepay refunds" ON public.prepay_refunds
      FOR SELECT TO authenticated
      USING (clinic_id = (SELECT public.get_my_clinic_id())
             AND (SELECT public.get_my_role()) IN ('owner', 'super_admin', 'admin', 'clinic_admin'));
  END IF;
END $$;


-- Bagian lain (reschedule/batal/hapus appointment, job malam, refund) ada di
-- supabase/manual/10_prepay_guards_and_refund.sql karena memuat DELETE.
