-- Uang cuti tahunan (sisa cuti x Rp100.000) yang dibayarkan di slip gaji
-- bulan terakhir MOU, khusus terapis yang sudah masuk tahun ke-2 atau lebih.
alter table payroll_records
  add column if not exists annual_leave_payout numeric not null default 0;

-- Status 'external' = MOU lama yang dibuat di luar aplikasi (sebelum Kaffah
-- memakai aplikasi ini). Dicatat hanya sebagai penanda riwayat masa kontrak
-- (tahun ke berapa), tanpa dokumen/scan, dan tidak tampil di menu Dokumen terapis.
alter table therapist_mou_documents drop constraint if exists therapist_mou_documents_status_check;
alter table therapist_mou_documents
  add constraint therapist_mou_documents_status_check
  check (status = any (array['draft'::text, 'signed'::text, 'external'::text]));
