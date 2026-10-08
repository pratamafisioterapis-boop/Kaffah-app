-- Terapis di tahun pertama bergabung belum mendapat jatah cuti tahunan.
-- Tahun pertama = tanggal cuti masih sebelum 1 tahun sejak join_date, atau MOU yang
-- berlaku pada tanggal itu masih periode ke-1 (sama dengan getTherapistAnnualLeaveBalance).
-- Aturan ini dipasang di database agar tidak bisa dilewati dari luar aplikasi.

CREATE OR REPLACE FUNCTION public.is_therapist_first_year(p_therapist_id uuid, p_date date)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    COALESCE((SELECT p.join_date IS NOT NULL AND p_date < (p.join_date + interval '1 year')::date
              FROM physiotherapists p WHERE p.id = p_therapist_id), false)
    OR EXISTS (
      SELECT 1 FROM therapist_mou_documents m
      WHERE m.physiotherapist_id = p_therapist_id
        AND m.period_number = 1
        AND p_date BETWEEN m.period_start AND m.period_end
    );
$fn$;
REVOKE EXECUTE ON FUNCTION public.is_therapist_first_year(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_therapist_first_year(uuid, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.block_annual_leave_first_year()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_date date;
BEGIN
  IF NEW.leave_type IS DISTINCT FROM 'annual' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'therapist_time_off' THEN
    v_date := NEW.start_date;
  ELSE
    v_date := NEW.leave_date;
  END IF;

  IF public.is_therapist_first_year(NEW.therapist_id, v_date) THEN
    RAISE EXCEPTION 'Terapis di tahun pertama bergabung belum mendapat jatah cuti tahunan'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_block_annual_leave_first_year ON public.therapist_time_off;
CREATE TRIGGER trg_block_annual_leave_first_year
  BEFORE INSERT OR UPDATE OF leave_type, start_date, therapist_id ON public.therapist_time_off
  FOR EACH ROW EXECUTE FUNCTION public.block_annual_leave_first_year();

DROP TRIGGER IF EXISTS trg_block_annual_leave_first_year ON public.therapist_leave_requests;
CREATE TRIGGER trg_block_annual_leave_first_year
  BEFORE INSERT OR UPDATE OF leave_type, leave_date, therapist_id ON public.therapist_leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.block_annual_leave_first_year();
