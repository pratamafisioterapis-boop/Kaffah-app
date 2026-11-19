-- Kaffah: pada paket RU (label berakhiran " RU"), diagnosa DOMS tetap dihitung Recovery
-- secara otomatis (tidak diturunkan jadi 1/2 keluhan dan tidak perlu "Ambil di luar paket").
-- Paket non-RU tetap seperti sebelumnya.
CREATE OR REPLACE FUNCTION public.trg_ac_package_followup_not_recovery()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  c_kaffah constant uuid := 'bfdc3fd8-a052-4753-a5b7-229930b3237a';
  v_target text;
  v_id uuid;
  v_pkg_name text;
BEGIN
  IF NEW.clinic_id IS DISTINCT FROM c_kaffah
     OR NEW.recap_date IS NULL OR NEW.recap_date < DATE '2026-10-19'
     OR NEW.package_tracking_id IS NULL
     OR NEW.bypass_package_id IS NOT NULL
     OR COALESCE(NEW.amount_original, NEW.amount, 0) <> 0 THEN
    RETURN NEW;
  END IF;

  SELECT pt.package_name INTO v_pkg_name FROM package_tracking pt WHERE pt.id = NEW.package_tracking_id;
  IF v_pkg_name ILIKE '% RU' THEN
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
