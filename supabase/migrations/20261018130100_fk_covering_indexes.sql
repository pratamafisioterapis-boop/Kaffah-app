-- Index untuk foreign key yang sering dipakai join/filter tapi belum punya
-- index (advisor Supabase: unindexed_foreign_keys). Hanya tabel aktif dengan
-- ratusan baris ke atas; tabel kecil/backup dibiarkan supaya tulis tetap ringan.
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_daily_recaps_created_by ON public.daily_recaps (created_by);
CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON public.appointments (service_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_created_by ON public.medical_records (created_by);
CREATE INDEX IF NOT EXISTS idx_medical_records_filled_by_admin_id ON public.medical_records (filled_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_invoice_records_created_by ON public.invoice_records (created_by);
CREATE INDEX IF NOT EXISTS idx_medical_records_detailed_created_by ON public.medical_records_detailed (created_by);
CREATE INDEX IF NOT EXISTS idx_medical_records_detailed_therapist_id ON public.medical_records_detailed (therapist_id);
