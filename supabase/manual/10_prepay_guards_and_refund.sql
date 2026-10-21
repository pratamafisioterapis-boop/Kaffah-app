-- Bagian "destruktif" dari fitur bayar di muka. Jalankan SATU KALI di Supabase SQL Editor
-- (setelah migrasi 20261021060000_prepay_package.sql). Berisi fungsi/trigger yang memuat
-- DELETE, sehingga tidak bisa dijalankan otomatis oleh asisten.
--
-- Isi: (1) reschedule memindahkan recap berbayar, batal ditolak sebelum refund,
--      (2) appointment berbayar di muka tidak bisa dihapus sebelum refund,
--      (3) job malam tidak menghapus recap berbayar di muka,
--      (4) fungsi refund penuh oleh owner.
-- Aman dijalankan ulang (CREATE OR REPLACE / cek keberadaan trigger).

-- 5a. Reschedule memindahkan recap (bukan menghapus); batal/no-show ditolak sebelum refund.
CREATE OR REPLACE FUNCTION public.trg_appointment_update_recap()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_therapist_name text;
  v_new_recap_date date;
  v_today date;
  v_pre record;
BEGIN
    -- Recap berbayar di muka yang belum dimulai.
    SELECT d.id, d.package_tracking_id INTO v_pre
    FROM daily_recaps d
    WHERE d.appointment_id = NEW.id AND d.prepaid_at IS NOT NULL AND d.start_time IS NULL
    LIMIT 1;

    IF FOUND THEN
        IF NEW.status IN ('cancelled', 'no_show', 'rejected') THEN
            RAISE EXCEPTION 'Appointment ini sudah dibayar di muka (paket). Minta owner melakukan refund terlebih dahulu sebelum membatalkan.';
        END IF;

        IF NEW.appointment_date <> OLD.appointment_date OR
           NEW.therapist_id IS DISTINCT FROM OLD.therapist_id OR
           NEW.status <> OLD.status THEN

            v_new_recap_date := (NEW.appointment_date AT TIME ZONE 'Asia/Makassar')::date;

            IF NEW.therapist_id IS DISTINCT FROM OLD.therapist_id THEN
                SELECT name INTO v_therapist_name FROM physiotherapists WHERE id = NEW.therapist_id;
            END IF;

            UPDATE daily_recaps
            SET recap_date     = v_new_recap_date,
                therapist_id   = NEW.therapist_id,
                therapist_name = COALESCE(v_therapist_name, therapist_name),
                updated_at     = NOW()
            WHERE id = v_pre.id;

            -- Sesi pertama paket belum jalan: geser masa berlaku paket mengikuti tanggal baru.
            IF v_pre.package_tracking_id IS NOT NULL
               AND (SELECT COUNT(*) FROM daily_recaps WHERE package_tracking_id = v_pre.package_tracking_id) = 1 THEN
                UPDATE package_tracking
                SET start_date = v_new_recap_date,
                    end_date = CASE
                      WHEN extended_until IS NULL AND validity_days IS NOT NULL
                        THEN (v_new_recap_date + (validity_days || ' days')::interval)::date
                      ELSE end_date
                    END,
                    updated_at = now()
                WHERE id = v_pre.package_tracking_id;
                PERFORM recalculate_package_sessions(v_pre.package_tracking_id);
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    IF NEW.status IN ('cancelled', 'no_show', 'rejected') THEN
        DELETE FROM daily_recaps WHERE appointment_id = NEW.id;
        RETURN NEW;
    END IF;

    IF NEW.appointment_date <> OLD.appointment_date OR
       NEW.therapist_id <> OLD.therapist_id OR
       NEW.status <> OLD.status THEN

        v_new_recap_date := (NEW.appointment_date AT TIME ZONE 'Asia/Makassar')::date;
        v_today := (NOW() AT TIME ZONE 'Asia/Makassar')::date;

        IF v_new_recap_date > v_today THEN
            -- Rescheduled to a future date: the existing recap (if any) is
            -- now premature. Drop it; the nightly job will recreate it on
            -- the correct day.
            DELETE FROM daily_recaps WHERE appointment_id = NEW.id;
            RETURN NEW;
        END IF;

        IF NEW.therapist_id IS DISTINCT FROM OLD.therapist_id THEN
            SELECT name INTO v_therapist_name FROM physiotherapists WHERE id = NEW.therapist_id;
        END IF;

        UPDATE daily_recaps
        SET
            recap_date     = v_new_recap_date,
            therapist_id   = NEW.therapist_id,
            therapist_name = COALESCE(v_therapist_name, therapist_name),
            updated_at     = NOW()
        WHERE appointment_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$function$;

-- 5b. Appointment dengan recap berbayar di muka tidak boleh dihapus sebelum refund.
CREATE OR REPLACE FUNCTION public.guard_delete_prepaid_appointment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM daily_recaps d
    WHERE d.appointment_id = OLD.id AND d.prepaid_at IS NOT NULL AND d.start_time IS NULL
  ) THEN
    RAISE EXCEPTION 'Appointment ini sudah dibayar di muka (paket). Lakukan refund oleh owner terlebih dahulu.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$function$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.appointments'::regclass AND tgname = 'trg_guard_delete_prepaid_appointment'
  ) THEN
    CREATE TRIGGER trg_guard_delete_prepaid_appointment
      BEFORE DELETE ON public.appointments
      FOR EACH ROW EXECUTE FUNCTION public.guard_delete_prepaid_appointment();
  END IF;
END $$;

-- 5d. Job malam: jangan hapus recap berbayar di muka.
CREATE OR REPLACE FUNCTION public.generate_today_daily_recaps()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  rec RECORD;
  v_therapist_name text;
  v_pkg_tracking_id uuid;
  v_package_type text;
  v_recap_date date;
  v_today date;
BEGIN

  v_today := (NOW() AT TIME ZONE 'Asia/Makassar')::date;

  -- 🔒 SAFETY NET 1: bersihkan recap yang appointment-nya sudah cancelled
  -- tapi recap masih nyangkut (belum pernah dimulai), apapun jalur cancel-nya
  DELETE FROM daily_recaps d
  USING appointments a
  WHERE d.appointment_id = a.id
    AND a.status = 'cancelled'
    AND d.status = 'pending'
    AND d.start_time IS NULL
    AND d.prepaid_at IS NULL;

  -- 🔒 SAFETY NET 2: bersihkan recap yang tanggalnya masih di masa depan
  -- (harusnya baru dibuat oleh job ini pada hari-H, bukan lebih awal).
  -- JANGAN hapus kalau appointment-nya masih aktif (confirmed/rescheduled) --
  -- itu recap sah untuk appointment yang di-reschedule ke tanggal mendatang,
  -- bukan recap yang salah dibuat lebih awal.
  DELETE FROM daily_recaps d
  WHERE d.recap_date > v_today
    AND d.status = 'pending'
    AND d.start_time IS NULL
    AND d.prepaid_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = d.appointment_id
        AND a.status IN ('confirmed', 'rescheduled')
    );

  FOR rec IN
    SELECT a.*
    FROM appointments a
    WHERE a.status IN ('confirmed', 'rescheduled')   -- tambah rescheduled
      AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::date = v_today
      AND NOT EXISTS (
        SELECT 1
        FROM daily_recaps d
        WHERE d.appointment_id = a.id
      )
  LOOP

    v_recap_date := (rec.appointment_date AT TIME ZONE 'Asia/Makassar')::date;

    SELECT name
    INTO v_therapist_name
    FROM physiotherapists
    WHERE id = rec.therapist_id;

    v_pkg_tracking_id := NULL;
    v_package_type    := NULL;

    -- Kalau recap utk appointment ini somehow sudah ada & ke-link paket
    -- (mis. race condition), pertahankan link itu, jangan dicari ulang.
    SELECT dr.package_tracking_id, dr.package_type
    INTO v_pkg_tracking_id, v_package_type
    FROM daily_recaps dr
    WHERE dr.appointment_id = rec.id
      AND dr.patient_id IS NOT DISTINCT FROM rec.patient_id;

    IF v_pkg_tracking_id IS NULL AND rec.patient_id IS NOT NULL THEN
      SELECT pt.id, pt.package_name
      INTO v_pkg_tracking_id, v_package_type
      FROM package_tracking pt
      WHERE pt.patient_id = rec.patient_id
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
      rec.id,
      CASE WHEN rec.patient_id IS NOT NULL THEN rec.patient_id ELSE NULL END,
      rec.therapist_id,
      v_therapist_name,
      CASE WHEN rec.patient_id IS NOT NULL THEN 'registered' ELSE 'guest' END,
      v_recap_date,
      NOW(),
      NOW(),
      rec.status,
      v_pkg_tracking_id,
      v_package_type,
      CASE WHEN v_pkg_tracking_id IS NOT NULL THEN 'Package' ELSE NULL END,
      rec.guest_name,
      rec.guest_phone,
      rec.clinic_id
    )
    ON CONFLICT (appointment_id)
    DO UPDATE SET
      therapist_id      = EXCLUDED.therapist_id,
      therapist_name    = EXCLUDED.therapist_name,
      guest_name        = EXCLUDED.guest_name,
      guest_phone       = EXCLUDED.guest_phone,
      status            = EXCLUDED.status,
      updated_at        = NOW(),
      package_tracking_id = EXCLUDED.package_tracking_id,
      package_type      = EXCLUDED.package_type,
      payment_method    = CASE
        WHEN EXCLUDED.package_tracking_id IS NOT NULL THEN 'Package'
        ELSE NULL
      END,
      clinic_id         = COALESCE(daily_recaps.clinic_id, EXCLUDED.clinic_id);

  END LOOP;

END;
$function$;

-- 4. Refund penuh oleh owner --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_prepaid_package(
  p_recap_id uuid,
  p_reason text,
  p_cancel_appointment boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_role text := get_my_role();
  v_clinic uuid := get_my_clinic_id();
  r daily_recaps;
  v_other integer;
  v_patient_name text;
  v_refund_id uuid;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('owner', 'super_admin') THEN
    RAISE EXCEPTION 'Hanya owner yang dapat melakukan refund.' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Alasan refund wajib diisi (minimal 5 karakter).';
  END IF;

  SELECT * INTO r FROM daily_recaps WHERE id = p_recap_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recap tidak ditemukan.';
  END IF;
  IF v_role <> 'super_admin' AND r.clinic_id IS DISTINCT FROM v_clinic THEN
    RAISE EXCEPTION 'Recap bukan milik klinik Anda.' USING ERRCODE = '42501';
  END IF;
  IF r.prepaid_at IS NULL THEN
    RAISE EXCEPTION 'Recap ini bukan pembayaran di muka.';
  END IF;
  IF r.start_time IS NOT NULL OR r.soap_completed_at IS NOT NULL
     OR EXISTS (SELECT 1 FROM medical_records m WHERE m.daily_recap_id = r.id) THEN
    RAISE EXCEPTION 'Terapi sudah dimulai/dicatat, refund tidak bisa dilakukan dari sini.';
  END IF;

  IF r.package_tracking_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_other FROM daily_recaps
    WHERE package_tracking_id = r.package_tracking_id AND id <> r.id;
    IF v_other > 0 THEN
      RAISE EXCEPTION 'Paket ini sudah dipakai di sesi lain. Refund sebagian tidak didukung.';
    END IF;
  END IF;

  SELECT full_name INTO v_patient_name FROM patients WHERE id = COALESCE(r.actual_patient_id, r.patient_id);

  INSERT INTO prepay_refunds (
    clinic_id, recap_id, appointment_id, patient_id, patient_name, package_name,
    amount, payment_method, receipt_number, paid_at, therapy_date, reason, refunded_by, snapshot
  ) VALUES (
    r.clinic_id, r.id, r.appointment_id, COALESCE(r.actual_patient_id, r.patient_id), v_patient_name, r.package_type,
    COALESCE(r.amount, 0), r.payment_method, r.receipt_number, r.invoice_created_at, r.recap_date,
    btrim(p_reason), auth.uid(), to_jsonb(r)
  ) RETURNING id INTO v_refund_id;

  PERFORM set_config('app.invoice_delete_override', 'on', true);
  DELETE FROM daily_recaps WHERE id = r.id;

  IF r.package_tracking_id IS NOT NULL THEN
    BEGIN
      DELETE FROM package_tracking WHERE id = r.package_tracking_id;
    EXCEPTION WHEN foreign_key_violation THEN
      UPDATE package_tracking SET status = 'dibatalkan', updated_at = now() WHERE id = r.package_tracking_id;
    END;
  END IF;

  IF p_cancel_appointment AND r.appointment_id IS NOT NULL THEN
    UPDATE appointments SET status = 'cancelled', updated_at = now() WHERE id = r.appointment_id;
  END IF;
  PERFORM set_config('app.invoice_delete_override', 'off', true);

  RETURN jsonb_build_object('refund_id', v_refund_id, 'amount', COALESCE(r.amount, 0));
END;
$fn$;

REVOKE ALL ON FUNCTION public.refund_prepaid_package(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_prepaid_package(uuid, text, boolean) TO authenticated;
