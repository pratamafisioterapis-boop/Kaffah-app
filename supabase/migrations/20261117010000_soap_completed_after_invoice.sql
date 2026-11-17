-- SOAP yang diisi SETELAH invoice terbit harus tetap tercatat selesai (soap_completed_at).
-- Bug: trg_ab_soap_first_prepare keluar lebih awal untuk recap terkunci (invoice terbit), sehingga
-- SOAP lengkap yang diisi sesudahnya tidak pernah dicap selesai -> sesi dianggap "SOAP tidak diisi"
-- dan insentif terapis nol padahal SOAP diisi tepat waktu.
-- Perbaikan: (1) cap waktu SOAP selesai dipindah ke sebelum blok terkunci; (2) TTV yang diisi
-- setelah invoice terbit juga memicu penilaian ulang recap.

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

  -- Waktu SOAP selesai dicatat server walau invoice sudah terbit (invoice terbit lebih dulu
  -- dari SOAP, mis. homecare). Sebelumnya blok terkunci keluar lebih awal sehingga SOAP
  -- yang diisi setelah invoice tidak pernah tercatat selesai dan terhitung 'tidak diisi'.
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

-- TTV diisi sesudah SOAP (termasuk setelah invoice terbit): nilai ulang recap agar SOAP tercatat selesai.
CREATE OR REPLACE FUNCTION public.trg_recap_vitals_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.recap_id IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE daily_recaps d
  SET updated_at = now()
  WHERE d.id = NEW.recap_id
    AND d.soap_completed_at IS NULL
    AND EXISTS (
      SELECT 1 FROM soap_first_settings s
      WHERE s.clinic_id = d.clinic_id AND s.enabled AND s.ttv_required AND d.recap_date >= s.start_date
    );
  RETURN NEW;
END;
$fn$;

-- Pulihkan recap yang sudah diinvoice dengan SOAP lengkap + diagnosa (+ TTV bila wajib) tetapi
-- soap_completed_at masih kosong. Waktu SOAP = waktu SOAP lengkap tersimpan.
DO $$
BEGIN
  PERFORM set_config('app.soap_first_rpc', 'on', true);
  UPDATE public.daily_recaps d
  SET soap_completed_at = m.t, updated_at = now()
  FROM (
    SELECT mr.daily_recap_id AS rid, max(mr.created_at) AS t
    FROM public.medical_records mr
    WHERE NULLIF(btrim(COALESCE(mr.subjective, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(mr.objective, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(mr.assessment, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(mr.plan, '')), '') IS NOT NULL
    GROUP BY mr.daily_recap_id
  ) m
  WHERE d.id = m.rid
    AND d.soap_completed_at IS NULL
    AND d.invoice_created_at IS NOT NULL
    AND COALESCE(array_length(public.soap_first_diag_ids(d.diagnosis), 1), 0) >= 1
    AND EXISTS (
      SELECT 1 FROM public.soap_first_settings s
      WHERE s.clinic_id = d.clinic_id AND s.enabled AND d.recap_date >= s.start_date
    );
END $$;
