-- Kaffah: DOMS pada sesi lanjutan paket yang MASIH memotong kuota tidak dihitung Recovery,
-- melainkan 1 keluhan (NORMAL) / 2 keluhan (DUA KELUHAN), termasuk untuk insentif terapis.
-- Baru jadi Recovery bila terapis memilih "di luar paket" (recap lepas dari paket).
-- Jalan setelah ab_soap_first_prepare (yang menurunkan tipe pasien dari diagnosa).
-- Hanya recap mulai 2026-10-19 agar data lama tidak berubah.
CREATE OR REPLACE FUNCTION public.trg_ac_package_followup_not_recovery()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  c_kaffah constant uuid := 'bfdc3fd8-a052-4753-a5b7-229930b3237a';
  v_target text;
  v_id uuid;
BEGIN
  IF NEW.clinic_id IS DISTINCT FROM c_kaffah
     OR NEW.recap_date IS NULL OR NEW.recap_date < DATE '2026-10-19'
     OR NEW.package_tracking_id IS NULL
     OR NEW.bypass_package_id IS NOT NULL
     OR COALESCE(NEW.amount_original, NEW.amount, 0) <> 0 THEN
    RETURN NEW;
  END IF;

  v_target := CASE NEW.patient_type
    WHEN 'RECOVERY' THEN 'NORMAL'
    WHEN 'RECOVERY+TREATMENT' THEN 'DUA KELUHAN'
  END;
  IF v_target IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT o.id INTO v_id FROM operational_options o
  WHERE o.clinic_id = NEW.clinic_id AND o.category = 'patient_type' AND o.label = v_target LIMIT 1;
  IF v_id IS NOT NULL THEN
    NEW.patient_type_ids := ARRAY[v_id];
    NEW.patient_type := v_target;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS ac_package_followup_not_recovery ON public.daily_recaps;
CREATE TRIGGER ac_package_followup_not_recovery
  BEFORE INSERT OR UPDATE ON public.daily_recaps
  FOR EACH ROW EXECUTE FUNCTION public.trg_ac_package_followup_not_recovery();
