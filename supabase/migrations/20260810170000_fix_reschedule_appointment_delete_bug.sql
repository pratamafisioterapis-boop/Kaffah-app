-- Bug: appointments rescheduled to a future date were being silently hard-deleted
-- by the nightly cron job.
--
-- Contoh nyata: pasien "kak Hermanto" (terapis Alma), appointment awalnya 9 Agustus
-- 2026 12:00, di-reschedule ke 11 Agustus 2026 19:00 pukul 12:56. Appointment
-- tampil benar di tgl 11 Agustus sesaat setelah reschedule, tapi hilang total
-- sebelum tengah hari berikutnya.
--
-- Root cause (dikonfirmasi lewat audit_logs, timestamp presisi ke milidetik):
-- 1. Saat appointment dibuat (untuk hari yang sama), trg_appointment_confirmed_to_recap
--    langsung membuat baris daily_recaps terkait (recap_date = hari itu).
-- 2. Saat di-reschedule ke tanggal mendatang, trg_appointment_update_recap ikut
--    menggeser recap_date baris daily_recaps yang sama ke tanggal baru itu --
--    tanpa penjagaan, padahal trigger di jalur INSERT justru menolak membuat
--    recap untuk tanggal masa depan. Jadi ada baris daily_recaps yang sah tapi
--    "prematur" (recap_date di masa depan, status pending, belum dimulai).
-- 3. Cron job malam generate_today_daily_recaps() punya "Safety Net 2" yang
--    menghapus SEMUA daily_recaps dengan recap_date > hari ini, status pending,
--    dan belum dimulai -- dengan asumsi itu recap yang salah dibuat lebih awal.
--    Recap appointment yang baru di-reschedule ikut cocok kriteria ini dan
--    ikut terhapus, walau itu bukan recap yang salah buat.
-- 4. Trigger trg_delete_appointment_when_recap_deleted (AFTER DELETE ON
--    daily_recaps) lalu ikut menghapus appointments-nya juga, karena statusnya
--    ('rescheduled') tidak termasuk dalam daftar pengecualian
--    (cancelled/no_show/rejected).
--
-- Fix:
-- - Safety Net 2 sekarang mengecualikan recap yang appointment-nya masih aktif
--   (confirmed/rescheduled), supaya recap hasil reschedule yang sah tidak lagi
--   ikut terhapus (dan appointment-nya pun tidak ikut kena delete berantai).
-- - trg_appointment_update_recap: saat reschedule menggeser tanggal ke masa
--   depan, recap lama dihapus (bukan digeser jadi "prematur") -- akan dibuat
--   ulang dengan benar oleh generate_today_daily_recaps() pada hari-H yang
--   sesuai. Ini menutup sumber recap "future-dated pending" yang memicu bug di
--   atas, sekaligus menyamakan perilaku dengan jalur INSERT.
--
-- Appointment "kak Hermanto" yang terhapus sudah direstore manual (data lengkap
-- diambil dari audit_logs) sebelum migration ini diterapkan.

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
    AND d.start_time IS NULL;

  -- 🔒 SAFETY NET 2: bersihkan recap yang tanggalnya masih di masa depan
  -- (harusnya baru dibuat oleh job ini pada hari-H, bukan lebih awal).
  -- JANGAN hapus kalau appointment-nya masih aktif (confirmed/rescheduled) --
  -- itu recap sah untuk appointment yang di-reschedule ke tanggal mendatang,
  -- bukan recap yang salah dibuat lebih awal.
  DELETE FROM daily_recaps d
  WHERE d.recap_date > v_today
    AND d.status = 'pending'
    AND d.start_time IS NULL
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

CREATE OR REPLACE FUNCTION public.trg_appointment_update_recap()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_therapist_name text;
  v_new_recap_date date;
  v_today date;
BEGIN
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
