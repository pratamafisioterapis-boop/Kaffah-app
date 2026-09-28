-- Tambah kolom patient_type_ids (uuid[]) di daily_recaps & service_rates supaya
-- tarif jasa terapis dicocokkan lewat ID operational_options (Tipe Pasien),
-- bukan lagi lewat pencocokan teks nama tipe pasien yang rawan salah tangkap
-- (mis. "DUA KELUHAN" ketangkep sebagai substring dari "XTRATIME+DUA KELUHAN").
--
-- Kolom teks lama (daily_recaps.patient_type, service_rates.service_name) TETAP
-- dipertahankan sebagai fallback untuk data lama yang tidak berhasil di-backfill
-- (mis. tipe pasien yang sudah dihapus/diganti nama di Setup) dan untuk tampilan.

ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS patient_type_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

ALTER TABLE public.service_rates
  ADD COLUMN IF NOT EXISTS patient_type_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS idx_daily_recaps_patient_type_ids
  ON public.daily_recaps USING gin (patient_type_ids);

CREATE INDEX IF NOT EXISTS idx_service_rates_patient_type_ids
  ON public.service_rates USING gin (patient_type_ids);

-- ============================================================
-- Backfill service_rates.patient_type_ids
-- ============================================================
-- 1. Pecah service_name (mis. "XTRATIME+DUA KELUHAN") jadi komponennya lalu
--    cocokkan tiap komponen ke operational_options (kategori patient_type)
--    milik klinik yang sama. Hanya diisi kalau SEMUA komponen berhasil
--    dicocokkan.
WITH parts AS (
  SELECT sr.id AS rate_id, sr.clinic_id, trim(p) AS part
  FROM public.service_rates sr,
       LATERAL unnest(regexp_split_to_array(
         coalesce(sr.service_name, ''),
         '\s*\+\s*|\s+dan\s+|\s*&\s*|\s*/\s*',
         'i'
       )) AS p
  WHERE sr.clinic_id IS NOT NULL AND trim(coalesce(sr.service_name, '')) <> ''
),
parts_clean AS (
  SELECT rate_id, clinic_id, part FROM parts WHERE trim(part) <> ''
),
part_counts AS (
  SELECT rate_id, count(*) AS total_parts FROM parts_clean GROUP BY rate_id
),
matched AS (
  SELECT pc.rate_id, oo.id AS type_id
  FROM parts_clean pc
  JOIN public.operational_options oo
    ON oo.category = 'patient_type'
   AND oo.clinic_id = pc.clinic_id
   AND lower(trim(oo.label)) = lower(trim(pc.part))
),
matched_counts AS (
  SELECT rate_id, array_agg(DISTINCT type_id ORDER BY type_id) AS ids, count(DISTINCT type_id) AS matched_parts
  FROM matched
  GROUP BY rate_id
)
UPDATE public.service_rates sr
SET patient_type_ids = mc.ids
FROM matched_counts mc
JOIN part_counts pcnt ON pcnt.rate_id = mc.rate_id
WHERE sr.id = mc.rate_id
  AND mc.matched_parts = pcnt.total_parts;

-- 2. Exact match ke SATU opsi Tipe Pasien menang atas hasil pecah-komponen di
--    atas — beberapa klinik punya Tipe Pasien yang namanya sendiri sudah
--    berupa gabungan literal (mis. "XTRATIME+DUA KELUHAN" sebagai SATU opsi
--    tersendiri di Setup, bukan hasil kombinasi dua opsi lain), jadi harus
--    dipetakan ke ID tunggalnya sendiri, bukan dipecah jadi dua ID.
UPDATE public.service_rates sr
SET patient_type_ids = ARRAY[oo.id]::uuid[]
FROM public.operational_options oo
WHERE oo.category = 'patient_type'
  AND oo.clinic_id = sr.clinic_id
  AND lower(trim(oo.label)) = lower(trim(coalesce(sr.service_name, '')));

-- ============================================================
-- Backfill daily_recaps.patient_type_ids (logika sama)
-- ============================================================
WITH parts AS (
  SELECT dr.id AS recap_id, dr.clinic_id, trim(p) AS part
  FROM public.daily_recaps dr,
       LATERAL unnest(regexp_split_to_array(
         coalesce(dr.patient_type, ''),
         '\s*\+\s*|\s+dan\s+|\s*&\s*|\s*/\s*',
         'i'
       )) AS p
  WHERE dr.clinic_id IS NOT NULL AND trim(coalesce(dr.patient_type, '')) <> ''
),
parts_clean AS (
  SELECT recap_id, clinic_id, part FROM parts WHERE trim(part) <> ''
),
part_counts AS (
  SELECT recap_id, count(*) AS total_parts FROM parts_clean GROUP BY recap_id
),
matched AS (
  SELECT pc.recap_id, oo.id AS type_id
  FROM parts_clean pc
  JOIN public.operational_options oo
    ON oo.category = 'patient_type'
   AND oo.clinic_id = pc.clinic_id
   AND lower(trim(oo.label)) = lower(trim(pc.part))
),
matched_counts AS (
  SELECT recap_id, array_agg(DISTINCT type_id ORDER BY type_id) AS ids, count(DISTINCT type_id) AS matched_parts
  FROM matched
  GROUP BY recap_id
)
UPDATE public.daily_recaps dr
SET patient_type_ids = mc.ids
FROM matched_counts mc
JOIN part_counts pcnt ON pcnt.recap_id = mc.recap_id
WHERE dr.id = mc.recap_id
  AND mc.matched_parts = pcnt.total_parts;

UPDATE public.daily_recaps dr
SET patient_type_ids = ARRAY[oo.id]::uuid[]
FROM public.operational_options oo
WHERE oo.category = 'patient_type'
  AND oo.clinic_id = dr.clinic_id
  AND lower(trim(oo.label)) = lower(trim(coalesce(dr.patient_type, '')));
