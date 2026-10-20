-- Fix: nomor receipt (RCPT/YYYYMM/NNNN) ganda antar pasien.
--
-- Penyebab: generate_monthly_receipt_number memakai COUNT(*) + 1 dari baris yang
-- sudah punya receipt_number di bulan itu. Begitu ada baris yang dihapus,
-- receipt_number-nya dikosongkan, atau recap_date-nya dipindah bulan, COUNT turun
-- dan nomor yang sama terbit lagi untuk pasien lain (mis. Noviansyah & Kiki
-- Nurwahyuni di 12 Okt 2026 dan puluhan pasangan lain sejak 2025).
--
-- Perbaikan: (1) generator memakai MAX(suffix)+1, (2) data lama yang kembar
-- dinomori ulang, (3) unique index agar tidak bisa terulang.

-- 1) Generator berbasis MAX(suffix) -----------------------------------------
CREATE OR REPLACE FUNCTION public.generate_monthly_receipt_number(p_recap_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
    v_recap_date DATE;
    v_year_month TEXT;
    v_max INTEGER;
    v_new_number TEXT;
BEGIN
    SELECT recap_date INTO v_recap_date
    FROM daily_recaps
    WHERE id = p_recap_id;

    IF v_recap_date IS NULL THEN
        RAISE EXCEPTION 'Recap date not found';
    END IF;

    v_year_month := TO_CHAR(v_recap_date, 'YYYYMM');

    -- Kunci per bulan agar insert bersamaan tidak membaca nilai yang sama.
    PERFORM pg_advisory_xact_lock(hashtext('receipt_number_' || v_year_month));

    SELECT COALESCE(MAX(SUBSTRING(receipt_number FROM '^RCPT/[0-9]{6}/([0-9]+)$')::INTEGER), 0)
    INTO v_max
    FROM daily_recaps
    WHERE receipt_number LIKE 'RCPT/' || v_year_month || '/%';

    v_new_number := 'RCPT/' || v_year_month || '/' || LPAD((v_max + 1)::TEXT, 4, '0');

    UPDATE daily_recaps
    SET receipt_number = v_new_number
    WHERE id = p_recap_id;

    RETURN v_new_number;
END;
$function$;

-- 2) Nomori ulang data lama yang kembar -------------------------------------
-- Pemegang nomor asli: yang sudah punya PDF invoice, lalu yang paling awal dibuat.
-- Sisanya mendapat nomor berikutnya (di atas MAX bulan itu), berurutan menurut created_at.
DO $$
DECLARE
    r RECORD;
    v_max INTEGER;
    v_ym TEXT;
BEGIN
    FOR v_ym IN
        SELECT DISTINCT SUBSTRING(receipt_number FROM 6 FOR 6)
        FROM daily_recaps
        WHERE receipt_number ~ '^RCPT/[0-9]{6}/[0-9]+$'
        ORDER BY 1
    LOOP
        PERFORM pg_advisory_xact_lock(hashtext('receipt_number_' || v_ym));

        SELECT COALESCE(MAX(SUBSTRING(receipt_number FROM '^RCPT/[0-9]{6}/([0-9]+)$')::INTEGER), 0)
        INTO v_max
        FROM daily_recaps
        WHERE receipt_number LIKE 'RCPT/' || v_ym || '/%';

        FOR r IN
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY receipt_number
                           ORDER BY (invoice_url IS NULL), created_at, id
                       ) AS rn,
                       created_at
                FROM daily_recaps
                WHERE receipt_number LIKE 'RCPT/' || v_ym || '/%'
            ) x
            WHERE x.rn > 1
            ORDER BY x.created_at, x.id
        LOOP
            v_max := v_max + 1;
            UPDATE daily_recaps
            SET receipt_number = 'RCPT/' || v_ym || '/' || LPAD(v_max::TEXT, 4, '0')
            WHERE id = r.id;
        END LOOP;
    END LOOP;
END $$;

-- 3) Cegah terulang ----------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS daily_recaps_receipt_number_rcpt_uniq
    ON public.daily_recaps (receipt_number)
    WHERE receipt_number LIKE 'RCPT/%';
