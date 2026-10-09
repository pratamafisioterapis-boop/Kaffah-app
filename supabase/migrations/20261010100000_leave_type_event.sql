-- Jenis izin baru "Event" pada pengajuan izin terapis (fitur izin khusus klinik
-- dengan therapist_leave_request_enabled, mis. Kaffah).
-- Seperti "Kegiatan Organisasi", jadwal pengganti tidak wajib (ditentukan peninjau).
--
-- File ini sengaja hanya berisi perubahan constraint (mengandung DROP CONSTRAINT).
-- Jika apply_migration membatalkannya karena dianggap destruktif, jalankan file ini
-- lewat SQL Editor dashboard Supabase. Logika RPC ada di 20261010110000.

ALTER TABLE public.therapist_leave_requests
  DROP CONSTRAINT IF EXISTS therapist_leave_requests_leave_type_check;
ALTER TABLE public.therapist_leave_requests
  ADD CONSTRAINT therapist_leave_requests_leave_type_check
  CHECK (leave_type IN ('annual', 'sick', 'training', 'personal', 'organization', 'event', 'other'));

ALTER TABLE public.therapist_leave_requests
  DROP CONSTRAINT IF EXISTS leave_request_needs_replacement;
ALTER TABLE public.therapist_leave_requests
  ADD CONSTRAINT leave_request_needs_replacement CHECK (
    jsonb_typeof(replacement_shifts) = 'array'
    AND (leave_type IN ('organization', 'event') OR jsonb_array_length(replacement_shifts) >= 1)
  );
