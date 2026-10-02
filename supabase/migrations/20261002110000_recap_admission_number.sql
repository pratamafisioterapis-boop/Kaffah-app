-- Admission number: nomor unik per kunjungan/sesi (satu baris daily_recaps),
-- berurutan per klinik, format PA00001. Dipakai di kwitansi ("Admission No / MR").
ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS admission_number text;

-- Backfill kunjungan lama: urut berdasarkan waktu dibuat per klinik.
WITH numbered AS (
  SELECT id,
         'PA' || LPAD(ROW_NUMBER() OVER (PARTITION BY clinic_id ORDER BY created_at, id)::text, 5, '0') AS adm
  FROM public.daily_recaps
  WHERE admission_number IS NULL AND clinic_id IS NOT NULL
)
UPDATE public.daily_recaps d
SET admission_number = n.adm
FROM numbered n
WHERE d.id = n.id;

CREATE UNIQUE INDEX IF NOT EXISTS daily_recaps_clinic_admission_number_key
  ON public.daily_recaps (clinic_id, admission_number);

CREATE OR REPLACE FUNCTION public.set_recap_admission_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max integer;
BEGIN
  IF NEW.admission_number IS NOT NULL OR NEW.clinic_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialisasi per klinik supaya dua kunjungan bersamaan tidak dapat nomor sama.
  PERFORM pg_advisory_xact_lock(hashtextextended('admission:' || NEW.clinic_id::text, 0));

  SELECT COALESCE(MAX(substring(admission_number FROM '^PA(\d+)$')::integer), 0)
  INTO v_max
  FROM public.daily_recaps
  WHERE clinic_id = NEW.clinic_id AND admission_number ~ '^PA\d+$';

  NEW.admission_number := 'PA' || LPAD((v_max + 1)::text, 5, '0');
  RETURN NEW;
END;
$$;

-- Prefix "zz_" agar jalan setelah trg_set_clinic_id mengisi clinic_id.
DROP TRIGGER IF EXISTS zz_set_recap_admission_number ON public.daily_recaps;
CREATE TRIGGER zz_set_recap_admission_number
  BEFORE INSERT ON public.daily_recaps
  FOR EACH ROW EXECUTE FUNCTION public.set_recap_admission_number();
