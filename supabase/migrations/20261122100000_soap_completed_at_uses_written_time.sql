-- SOAP yang ditulis tepat waktu tetap dihitung tepat waktu walau TTV diisi belakangan.
-- Sebelumnya soap_completed_at dicap now() saat syarat terakhir (TTV) terpenuhi, sehingga SOAP yang
-- ditulis sebelum sesi berakhir dianggap terlambat bila TTV baru diisi sesudah deadline.
-- Sekarang saat soap_completed_at pertama kali terisi, nilainya = waktu SOAP (S/O/A/P lengkap)
-- terakhir tersimpan, tidak pernah lebih besar dari now().
-- Trigger "ac_" jalan setelah ab_soap_first_prepare (yang mencap) dan sebelum ad_soap_requires_ttv.

CREATE OR REPLACE FUNCTION public.trg_ac_soap_completed_at_written()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_written timestamptz;
BEGIN
  IF NEW.soap_completed_at IS NULL
     OR (TG_OP = 'UPDATE' AND OLD.soap_completed_at IS NOT NULL)
     OR COALESCE(current_setting('app.soap_first_rpc', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT max(COALESCE(m.updated_at, m.created_at)) INTO v_written
  FROM medical_records m
  WHERE m.daily_recap_id = NEW.id
    AND NULLIF(btrim(COALESCE(m.subjective, '')), '') IS NOT NULL
    AND NULLIF(btrim(COALESCE(m.objective, '')), '') IS NOT NULL
    AND NULLIF(btrim(COALESCE(m.assessment, '')), '') IS NOT NULL
    AND NULLIF(btrim(COALESCE(m.plan, '')), '') IS NOT NULL;

  IF v_written IS NOT NULL AND v_written < NEW.soap_completed_at THEN
    NEW.soap_completed_at := v_written;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.trg_ac_soap_completed_at_written() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ac_soap_completed_at_written ON public.daily_recaps;
CREATE TRIGGER ac_soap_completed_at_written
  BEFORE INSERT OR UPDATE ON public.daily_recaps
  FOR EACH ROW EXECUTE FUNCTION public.trg_ac_soap_completed_at_written();

-- Koreksi recap hari ini (22 Nov 2026) yang SOAP-nya ditulis lebih dulu daripada TTV.
DO $$
BEGIN
  PERFORM set_config('app.soap_first_rpc', 'on', true);
  UPDATE public.daily_recaps d
  SET soap_completed_at = m.t
  FROM (
    SELECT mr.daily_recap_id AS rid, max(COALESCE(mr.updated_at, mr.created_at)) AS t
    FROM public.medical_records mr
    WHERE NULLIF(btrim(COALESCE(mr.subjective, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(mr.objective, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(mr.assessment, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(mr.plan, '')), '') IS NOT NULL
    GROUP BY mr.daily_recap_id
  ) m
  WHERE d.id = m.rid
    AND d.recap_date = DATE '2026-11-22'
    AND d.soap_completed_at IS NOT NULL
    AND m.t < d.soap_completed_at;
END $$;
