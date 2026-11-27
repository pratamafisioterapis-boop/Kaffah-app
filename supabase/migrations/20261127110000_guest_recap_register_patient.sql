-- Pasien guest di daily recap bisa didaftarkan ke database pasien langsung dari detail recap.
-- * patients.source_recap_id: recap guest asal pasien (diisi saat didaftarkan lewat alur ini).
-- * link_guest_recap_to_patient(): menautkan recap guest ke pasien yang baru dibuat.
-- * delete_patient_of_deleted_guest_recap(): setelah recap dihapus manual (pasien batal terapi),
--   pasien yang dibuat dari alur ini ikut dihapus bila belum punya recap/appointment/paket lain.

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS source_recap_id uuid;
CREATE INDEX IF NOT EXISTS idx_patients_source_recap_id ON public.patients (source_recap_id) WHERE source_recap_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.link_guest_recap_to_patient(p_recap_id uuid, p_patient_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_recap public.daily_recaps%ROWTYPE;
BEGIN
  SELECT * INTO v_recap FROM public.daily_recaps WHERE id = p_recap_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recap tidak ditemukan';
  END IF;
  IF v_recap.patient_id IS NOT NULL THEN
    RAISE EXCEPTION 'Recap ini sudah tertaut ke pasien';
  END IF;

  UPDATE public.patients SET source_recap_id = p_recap_id WHERE id = p_patient_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pasien tidak ditemukan';
  END IF;

  UPDATE public.daily_recaps
     SET patient_id = p_patient_id,
         actual_patient_id = p_patient_id,
         patient_type = 'registered',
         updated_at = NOW()
   WHERE id = p_recap_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.link_guest_recap_to_patient(uuid, uuid) TO authenticated;

-- Dipanggil aplikasi SETELAH recap dihapus manual oleh admin/owner. Sengaja bukan trigger:
-- recap juga dihapus & dibuat ulang otomatis saat appointment di-reschedule, dan pasien tidak
-- boleh ikut terhapus pada kasus itu.
CREATE OR REPLACE FUNCTION public.delete_patient_of_deleted_guest_recap(p_recap_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_pid uuid;
BEGIN
  SELECT id INTO v_pid FROM public.patients WHERE source_recap_id = p_recap_id;
  IF v_pid IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.daily_recaps WHERE patient_id = v_pid OR actual_patient_id = v_pid)
     OR EXISTS (SELECT 1 FROM public.appointments WHERE patient_id = v_pid)
     OR EXISTS (SELECT 1 FROM public.package_tracking WHERE patient_id = v_pid) THEN
    RETURN false;
  END IF;
  BEGIN
    DELETE FROM public.patients WHERE id = v_pid AND source_recap_id = p_recap_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  RETURN FOUND;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.delete_patient_of_deleted_guest_recap(uuid) TO authenticated;
