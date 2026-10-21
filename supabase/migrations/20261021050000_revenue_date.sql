-- Tanggal pendapatan (uang masuk): tanggal pembayaran bila invoice sudah terbit
-- (invoice_created_at, waktu WITA), selain itu tanggal terapi (recap_date).
-- Contoh: terapi 19 Okt, bayar 20 Okt -> recap_date 19 Okt, revenue_date 20 Okt.
-- recap_date tetap tanggal terapi (urutan sesi paket, insentif, SOAP, daftar kunjungan).
-- Kolom biasa + trigger (bukan generated column) supaya klien yang mengirim seluruh
-- baris saat update tidak error; nilai kiriman klien selalu ditimpa trigger.
ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS revenue_date date;

CREATE OR REPLACE FUNCTION public.trg_zzz_set_revenue_date()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  NEW.revenue_date := COALESCE((NEW.invoice_created_at AT TIME ZONE 'Asia/Makassar')::date, NEW.recap_date);
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS zzz_set_revenue_date ON public.daily_recaps;
CREATE TRIGGER zzz_set_revenue_date
  BEFORE INSERT OR UPDATE ON public.daily_recaps
  FOR EACH ROW EXECUTE FUNCTION public.trg_zzz_set_revenue_date();

-- Isi data lama tanpa memicu trigger lain (audit, sync, dll).
DO $$
BEGIN
  SET LOCAL session_replication_role = replica;
  UPDATE public.daily_recaps
  SET revenue_date = COALESCE((invoice_created_at AT TIME ZONE 'Asia/Makassar')::date, recap_date)
  WHERE revenue_date IS NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_daily_recaps_clinic_revenue_date
  ON public.daily_recaps (clinic_id, revenue_date);

-- Laporan WA harian: pemasukan per metode dihitung dari uang yang masuk hari ini
-- (revenue_date), bukan dari tanggal terapi. Hitungan pasien/paket/kelengkapan
-- tetap berdasarkan tanggal terapi.
CREATE OR REPLACE FUNCTION public.send_daily_report()
 RETURNS TABLE(total_pasien integer, reguler integer, paket integer, cash numeric, qris numeric, debit numeric, transfer numeric, total_pemasukan numeric, lengkap integer, belum integer, tanpa_diagnosis integer, tanpa_tipe_pasien integer, tanpa_pembayaran integer, tanpa_jam integer, tanpa_terapis integer, invoice_sudah integer, invoice_belum integer, invoice_belum_list text)
 LANGUAGE sql
AS $function$
WITH base AS (
  SELECT *
  FROM daily_recaps
  WHERE recap_date = CURRENT_DATE
    AND (status IS NULL OR status != 'cancelled')
),

base_pay AS (
  SELECT *
  FROM daily_recaps
  WHERE revenue_date = CURRENT_DATE
    AND (status IS NULL OR status != 'cancelled')
),

total_pasien AS (
  SELECT COUNT(DISTINCT COALESCE(
    actual_patient_id::text,
    patient_id::text,
    guest_name
  )) AS total
  FROM base
),

layanan AS (
  SELECT
    COUNT(*) FILTER (WHERE package_type = 'REGULER') AS reguler,
    COUNT(*) FILTER (WHERE package_type ILIKE 'Paket%') AS paket
  FROM base
),

pemasukan AS (
  SELECT
    SUM(dr.amount) FILTER (
      WHERE LOWER(TRIM(COALESCE(oo.label, dr.payment_method))) = 'cash'
    ) AS cash,

    SUM(dr.amount) FILTER (
      WHERE LOWER(TRIM(COALESCE(oo.label, dr.payment_method))) = 'qris'
    ) AS qris,

    SUM(dr.amount) FILTER (
      WHERE LOWER(TRIM(COALESCE(oo.label, dr.payment_method))) = 'debit'
    ) AS debit,

    SUM(dr.amount) FILTER (
      WHERE LOWER(TRIM(COALESCE(oo.label, dr.payment_method))) = 'transfer'
    ) AS transfer,

    SUM(dr.amount) AS total
  FROM base_pay dr
  LEFT JOIN operational_options oo
    ON dr.payment_method = oo.id::text
),

kelengkapan AS (
  SELECT
    COUNT(*) FILTER (
      WHERE
        (diagnosis IS NOT NULL AND diagnosis != '{}'::jsonb AND diagnosis != '[]'::jsonb)
        AND payment_method IS NOT NULL
        AND start_time IS NOT NULL
        AND therapist_name IS NOT NULL
        AND patient_type IS NOT NULL
        AND LOWER(TRIM(patient_type)) != 'registered'
    ) AS lengkap,

    COUNT(*) FILTER (
      WHERE
        diagnosis IS NULL
        OR diagnosis = '{}'::jsonb
        OR diagnosis = '[]'::jsonb
        OR payment_method IS NULL
        OR start_time IS NULL
        OR therapist_name IS NULL
        OR patient_type IS NULL
        OR LOWER(TRIM(patient_type)) = 'registered'
    ) AS belum
  FROM base
),

detail_error AS (
  SELECT
    COUNT(*) FILTER (
      WHERE diagnosis IS NULL
         OR diagnosis = '{}'::jsonb
         OR diagnosis = '[]'::jsonb
    ) AS tanpa_diagnosis,

    COUNT(*) FILTER (
      WHERE patient_type IS NULL
         OR LOWER(TRIM(patient_type)) = 'registered'
    ) AS tanpa_tipe_pasien,

    COUNT(*) FILTER (WHERE payment_method IS NULL) AS tanpa_pembayaran,
    COUNT(*) FILTER (WHERE start_time IS NULL) AS tanpa_jam,
    COUNT(*) FILTER (WHERE therapist_name IS NULL) AS tanpa_terapis
  FROM base
),

invoice AS (
  SELECT
    COUNT(*) FILTER (
      WHERE invoice_url IS NOT NULL
        AND amount > 0
        AND payment_method != 'Package'
    ) AS sudah,

    COUNT(*) FILTER (
      WHERE invoice_url IS NULL
        AND amount > 0
        AND payment_method != 'Package'
    ) AS belum
  FROM base
),

invoice_list AS (
  SELECT
    STRING_AGG(
      '- ' || COALESCE(p.full_name, dr.guest_name),
      E'\n'
    ) AS list
  FROM base dr
  LEFT JOIN patients p ON dr.patient_id = p.id
  WHERE dr.invoice_url IS NULL
    AND dr.amount > 0
    AND dr.payment_method != 'Package'
)

SELECT
  tp.total,
  l.reguler,
  l.paket,
  p.cash,
  p.qris,
  p.debit,
  p.transfer,
  p.total,
  k.lengkap,
  k.belum,
  d.tanpa_diagnosis,
  d.tanpa_tipe_pasien,
  d.tanpa_pembayaran,
  d.tanpa_jam,
  d.tanpa_terapis,
  i.sudah,
  i.belum,
  il.list
FROM total_pasien tp
CROSS JOIN layanan l
CROSS JOIN pemasukan p
CROSS JOIN kelengkapan k
CROSS JOIN detail_error d
CROSS JOIN invoice i
CROSS JOIN invoice_list il;
$function$;
