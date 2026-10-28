-- Waktu homecare (dalam/luar jam kerja) wajib dipilih admin saat booking (Kaffah); tidak boleh
-- diisi otomatis. Trigger fallback dari 20261019130000_homecare_time_auto.sql dihapus.
-- Data lama yang NULL sengaja tidak di-backfill agar bisa ditinjau & diisi manual.
DROP TRIGGER IF EXISTS aa_appointment_homecare_time ON public.appointments;
DROP FUNCTION IF EXISTS public.trg_appointment_homecare_time();
