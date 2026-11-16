-- Praxis: paket "pending" (dibayar di muka, belum dipakai) harus otomatis tertaut dan aktif
-- saat sesi pertama dicatat.
--
-- Bug: paket yang dibeli lewat "Tambah Paket" berstatus 'pending' dengan start_date NULL.
-- Trigger auto-assign hanya mencari paket berstatus 'aktif'/'diperpanjang' dengan
-- start_date <= recap_date, sehingga recap sesi (amount 0) tidak pernah tertaut
-- (package_tracking_id NULL). Akibatnya Package Recaps tetap "pending" dan sisa sesi tidak
-- berkurang. recalculate_package_sessions juga sengaja tidak mengubah status 'pending'.
--
-- Perbaikan (khusus klinik Praxis, supaya alur Kaffah tidak berubah):
--  1. auto_assign_package_on_insert/on_update: bila tidak ada paket aktif yang cocok, tautkan
--     ke paket 'pending' pasien dengan nama paket sama yang masih punya sisa sesi.
--  2. recalculate_package_sessions: paket 'pending' Praxis yang sudah punya recap tertaut
--     diaktifkan (start_date = tanggal sesi pertama, end_date = start + masa berlaku).
--  3. Backfill recap yang sudah terlanjur tidak tertaut.

CREATE OR REPLACE FUNCTION public.auto_assign_package_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    c_praxis constant uuid := 'b25e8c29-6977-4e1b-b500-7629ec3aeb8a';
    v_package_id UUID;
    v_sessions_used INTEGER;
    v_total_sessions INTEGER;
    v_session_count INTEGER;
BEGIN
    IF NEW.package_tracking_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF COALESCE(NEW.amount::numeric, 0) > 0 THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(session_count, 0)
    INTO v_session_count
    FROM operational_options
    WHERE LOWER(TRIM(label)) = LOWER(TRIM(NEW.package_type))
      AND category = 'tipe_paket'
    LIMIT 1;

    IF COALESCE(v_session_count, 0) <= 1 THEN
        RETURN NEW;
    END IF;

    SELECT pt.id, pt.total_sessions,
           (SELECT COUNT(*) FROM daily_recaps dr2
            WHERE dr2.package_tracking_id = pt.id) as used_count
    INTO v_package_id, v_total_sessions, v_sessions_used
    FROM package_tracking pt
    WHERE pt.patient_id = NEW.patient_id
      AND LOWER(TRIM(pt.package_name)) = LOWER(TRIM(NEW.package_type))
      AND pt.start_date <= NEW.recap_date
      AND COALESCE(pt.extended_until, pt.end_date) >= NEW.recap_date
      AND pt.status IN ('aktif', 'diperpanjang')
    ORDER BY pt.start_date DESC
    LIMIT 1;

    -- Praxis: paket pending (dibayar di muka, belum dimulai)
    IF v_package_id IS NULL THEN
        SELECT pt.id, pt.total_sessions,
               (SELECT COUNT(*) FROM daily_recaps dr2
                WHERE dr2.package_tracking_id = pt.id) as used_count
        INTO v_package_id, v_total_sessions, v_sessions_used
        FROM package_tracking pt
        WHERE pt.patient_id = NEW.patient_id
          AND pt.clinic_id = c_praxis
          AND pt.status = 'pending'
          AND LOWER(TRIM(pt.package_name)) = LOWER(TRIM(NEW.package_type))
        ORDER BY pt.created_at ASC
        LIMIT 1;
    END IF;

    IF v_package_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF v_sessions_used >= v_total_sessions THEN
        RETURN NEW;
    END IF;

    NEW.package_tracking_id := v_package_id;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_assign_package_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    c_praxis constant uuid := 'b25e8c29-6977-4e1b-b500-7629ec3aeb8a';
    v_package_id UUID;
    v_sessions_used INTEGER;
    v_total_sessions INTEGER;
    v_session_count INTEGER;
BEGIN
    IF NEW.patient_id IS NOT DISTINCT FROM OLD.patient_id
       AND NEW.package_type IS NOT DISTINCT FROM OLD.package_type THEN
        RETURN NEW;
    END IF;

    IF NEW.package_tracking_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.patient_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF COALESCE(NEW.amount::numeric, 0) > 0 THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(session_count, 0)
    INTO v_session_count
    FROM operational_options
    WHERE LOWER(TRIM(label)) = LOWER(TRIM(NEW.package_type))
      AND category = 'tipe_paket'
    LIMIT 1;

    IF COALESCE(v_session_count, 0) <= 1 THEN
        RETURN NEW;
    END IF;

    SELECT pt.id, pt.total_sessions,
           (SELECT COUNT(*) FROM daily_recaps dr2
            WHERE dr2.package_tracking_id = pt.id) AS used_count
    INTO v_package_id, v_total_sessions, v_sessions_used
    FROM package_tracking pt
    WHERE pt.patient_id = NEW.patient_id
      AND LOWER(TRIM(pt.package_name)) = LOWER(TRIM(NEW.package_type))
      AND pt.start_date <= NEW.recap_date
      AND COALESCE(pt.extended_until, pt.end_date) >= NEW.recap_date
      AND pt.status IN ('aktif', 'diperpanjang')
    ORDER BY pt.start_date DESC
    LIMIT 1;

    IF v_package_id IS NULL THEN
        SELECT pt.id, pt.total_sessions,
               (SELECT COUNT(*) FROM daily_recaps dr2
                WHERE dr2.package_tracking_id = pt.id) AS used_count
        INTO v_package_id, v_total_sessions, v_sessions_used
        FROM package_tracking pt
        WHERE pt.patient_id = NEW.patient_id
          AND pt.clinic_id = c_praxis
          AND pt.status = 'pending'
          AND LOWER(TRIM(pt.package_name)) = LOWER(TRIM(NEW.package_type))
        ORDER BY pt.created_at ASC
        LIMIT 1;
    END IF;

    IF v_package_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF v_sessions_used >= v_total_sessions THEN
        RETURN NEW;
    END IF;

    NEW.package_tracking_id := v_package_id;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_package_sessions(p_package_id uuid, p_reference_date date DEFAULT CURRENT_DATE)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    c_praxis constant uuid := 'b25e8c29-6977-4e1b-b500-7629ec3aeb8a';
    v_total_sessions     integer;
    v_used               integer;
    v_remaining          integer;
    v_status             text;
    v_end_date           date;
    v_extended_until     date;
    v_current_status     text;
    v_effective_end_date date;
    v_clinic_id          uuid;
    v_validity_days      integer;
    v_first_date         date;
BEGIN
    SELECT total_sessions, end_date, extended_until, status, clinic_id, validity_days
    INTO v_total_sessions, v_end_date, v_extended_until, v_current_status, v_clinic_id, v_validity_days
    FROM package_tracking
    WHERE id = p_package_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT COUNT(*), MIN(recap_date)
    INTO v_used, v_first_date
    FROM daily_recaps
    WHERE package_tracking_id = p_package_id
      AND recap_date <= (now() AT TIME ZONE 'Asia/Makassar')::date;

    v_remaining := GREATEST(v_total_sessions - v_used, 0);

    -- Praxis: paket pending yang sudah dipakai -> mulai (aktif) dari tanggal sesi pertama.
    IF v_current_status = 'pending' AND v_clinic_id = c_praxis AND v_used > 0 THEN
        v_end_date := v_first_date + COALESCE(v_validity_days, 30);
        UPDATE package_tracking
        SET start_date    = v_first_date,
            end_date      = v_end_date,
            first_used_at = COALESCE(first_used_at, v_first_date),
            status        = 'aktif',
            updated_at    = now()
        WHERE id = p_package_id;
        v_current_status := 'aktif';
    END IF;

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

-- Backfill: recap Praxis amount 0 yang belum tertaut padahal pasien punya paket pending
-- bernama sama. Satu paket pending per pasien; hanya sebanyak sisa sesi.
DO $$
DECLARE
    c_praxis constant uuid := 'b25e8c29-6977-4e1b-b500-7629ec3aeb8a';
    r record;
BEGIN
    FOR r IN
        SELECT dr.id AS recap_id, pt.id AS pkg_id
        FROM daily_recaps dr
        JOIN package_tracking pt
          ON pt.patient_id = dr.patient_id
         AND pt.clinic_id = c_praxis
         AND pt.status = 'pending'
         AND LOWER(TRIM(pt.package_name)) = LOWER(TRIM(dr.package_type))
        WHERE dr.package_tracking_id IS NULL
          AND COALESCE(dr.amount, 0) = 0
          AND dr.recap_date >= pt.created_at::date
        ORDER BY dr.recap_date, dr.created_at
    LOOP
        UPDATE daily_recaps SET package_tracking_id = r.pkg_id WHERE id = r.recap_id;
    END LOOP;
END;
$$;
