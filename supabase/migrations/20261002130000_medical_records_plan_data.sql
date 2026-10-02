-- Checklist Plan SOAP (modalitas elektrofisis, manual therapy, exercise per diagnosa).
alter table public.medical_records add column if not exists plan_data jsonb;
comment on column public.medical_records.plan_data is 'Checklist Plan SOAP: { epa: [], manual: [], exercises: { id: true }, notes }. Teks ringkasan tetap disimpan di kolom plan.';
