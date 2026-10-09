-- Perbaikan: "Gagal membatalkan izin ... violates check constraint
-- leave_request_weekend_replacement_sunday".
--
-- Constraint NOT VALID tetap dicek setiap kali baris di-UPDATE. Izin lama yang
-- jatuh di Sabtu/Minggu dengan pengganti Senin-Jumat (disetujui sebelum aturan
-- ini ada) otomatis gagal saat status diubah (dibatalkan / ditolak).
-- Aturan "pengganti harus hari Minggu" hanya relevan untuk pengajuan baru,
-- jadi cukup dicek selama status masih 'pending'.
--
-- CATATAN: file ini berisi DROP CONSTRAINT, jalankan lewat SQL Editor Supabase
-- (bukan apply_migration, yang membatalkan statement destruktif).

ALTER TABLE public.therapist_leave_requests
  DROP CONSTRAINT IF EXISTS leave_request_weekend_replacement_sunday;

ALTER TABLE public.therapist_leave_requests
  ADD CONSTRAINT leave_request_weekend_replacement_sunday
  CHECK (status <> 'pending' OR public.leave_replacement_sunday_ok(leave_date, replacement_shifts)) NOT VALID;
