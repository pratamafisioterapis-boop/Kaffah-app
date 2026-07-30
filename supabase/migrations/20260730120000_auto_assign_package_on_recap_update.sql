-- Bug: saat admin meng-edit daily_recap yang tadinya "pasien baru"/guest (dari
-- online booking) lalu menyambungkannya ke pasien terdaftar + memilih jenis
-- paket yang sama dengan paket aktif pasien tsb, package_tracking_id TIDAK
-- pernah ikut ter-set. Trigger auto_assign_package_on_insert() cuma jalan
-- BEFORE INSERT, sedangkan edit lewat modal Rekap Harian selalu UPDATE.
-- Akibatnya package_type tampil benar di riwayat, tapi sesi paket
-- (sessions_used/sessions_remaining) tidak pernah berkurang untuk recap yang
-- diedit tsb.
--
-- Fix: tambahkan versi UPDATE dari logika auto-assign yang sudah ada,
-- dengan guard yang sama (package_tracking_id masih kosong, amount = 0,
-- package_type adalah paket multi-sesi, ada paket aktif milik pasien yang
-- cocok & masih ada sisa sesi). Trigger AFTER UPDATE
-- trg_after_package_created yang sudah ada akan otomatis memanggil
-- recalculate_package_sessions begitu package_tracking_id ini ter-set.

CREATE OR REPLACE FUNCTION public.auto_assign_package_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_package_id UUID;
    v_sessions_used INTEGER;
    v_total_sessions INTEGER;
    v_session_count INTEGER;
BEGIN
    -- Hindari kerja sia-sia kalau patient/jenis paket tidak berubah
    IF NEW.patient_id IS NOT DISTINCT FROM OLD.patient_id
       AND NEW.package_type IS NOT DISTINCT FROM OLD.package_type THEN
        RETURN NEW;
    END IF;

    -- Jangan timpa link yang sudah ada (biar tidak merusak paket lama)
    IF NEW.package_tracking_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.patient_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Hanya untuk pemakaian sesi (amount = 0), bukan pembelian paket baru
    IF COALESCE(NEW.amount::numeric, 0) > 0 THEN
        RETURN NEW;
    END IF;

    -- Cek apakah package_type adalah paket multi-sesi
    SELECT COALESCE(session_count, 0)
    INTO v_session_count
    FROM operational_options
    WHERE LOWER(TRIM(label)) = LOWER(TRIM(NEW.package_type))
      AND category = 'tipe_paket'
    LIMIT 1;

    IF COALESCE(v_session_count, 0) <= 1 THEN
        RETURN NEW;
    END IF;

    -- Cari paket aktif pasien yang cocok & masih ada sisa sesi
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
        RETURN NEW;
    END IF;

    IF v_sessions_used >= v_total_sessions THEN
        RETURN NEW;
    END IF;

    NEW.package_tracking_id := v_package_id;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_assign_package_on_update ON public.daily_recaps;
CREATE TRIGGER trg_auto_assign_package_on_update
    BEFORE UPDATE ON public.daily_recaps
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_assign_package_on_update();

-- Backfill data lama: recap yang sudah dilabeli package_type paket multi-sesi
-- tapi belum ter-link (package_tracking_id NULL) padahal pasiennya punya
-- paket aktif yang cocok & masih ada sisa sesi. Ini termasuk kasus Rulian
-- Arieftia Akbar (2 sesi 25 & 29 Juli 2026 yang belum terhitung).
WITH sub AS (
  SELECT dr2.id AS recap_id, pkg.id AS pkg_id
  FROM daily_recaps dr2
  JOIN operational_options oo
    ON LOWER(TRIM(oo.label)) = LOWER(TRIM(dr2.package_type))
   AND oo.category = 'tipe_paket'
   AND COALESCE(oo.session_count, 0) > 1
  JOIN LATERAL (
    SELECT pt.id, pt.total_sessions,
           (SELECT COUNT(*) FROM daily_recaps dr3 WHERE dr3.package_tracking_id = pt.id) AS used_count
    FROM package_tracking pt
    WHERE pt.patient_id = dr2.patient_id
      AND LOWER(TRIM(pt.package_name)) = LOWER(TRIM(dr2.package_type))
      AND pt.start_date <= dr2.recap_date
      AND COALESCE(pt.extended_until, pt.end_date) >= dr2.recap_date
      AND pt.status IN ('aktif', 'diperpanjang')
    ORDER BY pt.start_date DESC
    LIMIT 1
  ) pkg ON pkg.used_count < pkg.total_sessions
  WHERE dr2.package_tracking_id IS NULL
    AND COALESCE(dr2.amount::numeric, 0) = 0
)
UPDATE daily_recaps dr
SET package_tracking_id = sub.pkg_id
FROM sub
WHERE dr.id = sub.recap_id;
