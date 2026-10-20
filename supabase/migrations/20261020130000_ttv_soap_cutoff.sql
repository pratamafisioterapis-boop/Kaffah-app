-- TTV bagian dari SOAP hanya berlaku mulai pasien dengan jam appointment >= ttv_required_from
-- (Kaffah: 2026-10-20 17:00 WITA). Pasien sebelumnya tetap memakai sistem lama.
ALTER TABLE public.soap_first_settings
  ADD COLUMN IF NOT EXISTS ttv_required_from timestamptz;

UPDATE public.soap_first_settings
SET ttv_required_from = TIMESTAMPTZ '2026-10-20 17:00:00+08'
WHERE clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid;

CREATE OR REPLACE FUNCTION public.trg_ad_soap_requires_ttv()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_from timestamptz;
  v_found boolean;
  v_ref timestamptz;
BEGIN
  IF NEW.soap_completed_at IS NULL
     OR (TG_OP = 'UPDATE' AND NEW.soap_completed_at IS NOT DISTINCT FROM OLD.soap_completed_at) THEN
    RETURN NEW;
  END IF;

  SELECT true, s.ttv_required_from INTO v_found, v_from
  FROM soap_first_settings s
  WHERE s.clinic_id = NEW.clinic_id
    AND s.enabled AND s.ttv_required
    AND NEW.recap_date >= s.start_date;
  IF v_found IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Berlaku mulai pasien dengan jam appointment >= ttv_required_from; sebelumnya tetap sistem lama.
  IF v_from IS NOT NULL THEN
    v_ref := COALESCE(
      (SELECT a.appointment_date FROM appointments a WHERE a.id = NEW.appointment_id),
      NEW.start_time, NEW.created_at, now());
    IF v_ref < v_from THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM recap_vital_signs rv WHERE rv.recap_id = NEW.id) THEN
    NEW.soap_completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.trg_ad_soap_requires_ttv() FROM PUBLIC, anon, authenticated;

-- Memulihkan 3 recap Kaffah yang sempat dikembalikan ke "SOAP belum selesai" oleh migrasi
-- 20261020120000 padahal pasiennya sebelum batas waktu (nilai asli dipulihkan; no-op di lingkungan lain).
DO $$
BEGIN
  PERFORM set_config('app.soap_first_rpc', 'on', true);
  UPDATE public.daily_recaps d
  SET soap_completed_at = v.t, updated_at = now()
  FROM (VALUES
    ('ae4d3922-7280-4b40-95c1-480506788a45'::uuid, TIMESTAMPTZ '2026-10-20 13:28:35.036224+08'),
    ('4a8a5bfd-3bad-4177-9320-56f04d1ca7a0'::uuid, TIMESTAMPTZ '2026-10-20 15:44:53.970675+08'),
    ('65add742-b25a-465d-aea6-25b958b9ce28'::uuid, TIMESTAMPTZ '2026-10-19 14:04:12.377723+08')
  ) AS v(id, t)
  WHERE d.id = v.id AND d.soap_completed_at IS NULL AND d.invoice_created_at IS NULL;
END $$;
