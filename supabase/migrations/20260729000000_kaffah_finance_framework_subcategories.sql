-- Add the owner's full finance-framework subcategory list for clinic
-- Kaffah Physiotherapy (clinic_id = bfdc3fd8-a052-4753-a5b7-229930b3237a).
-- These are added alongside the pre-existing (historical) subcategory
-- names under each category — the owner will manually merge old
-- transactions into these new subcategories via the merge-subcategory
-- feature, after which the old subcategories can be deleted.

insert into accounting_subcategories (subcategory_name, category_id, clinic_id) values
-- COST OF SERVICE
('Jasa/Fee Fisioterapis (per sesi/insentif)', 'bf2b06b5-1367-4cae-836f-4e45a0bed62b', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Bahan habis pakai medis (kinesio tape, alat modalitas, dll)', 'bf2b06b5-1367-4cae-836f-4e45a0bed62b', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Laundry/linen', 'bf2b06b5-1367-4cae-836f-4e45a0bed62b', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Alat medis kecil (consumables)', 'bf2b06b5-1367-4cae-836f-4e45a0bed62b', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
-- FIXED COST
('Sewa gedung/ruko', 'ac5e6c59-24c1-47d9-b789-a8e4d0f31930', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Gaji karyawan tetap (admin, resepsionis)', 'ac5e6c59-24c1-47d9-b789-a8e4d0f31930', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Listrik, air, internet', 'ac5e6c59-24c1-47d9-b789-a8e4d0f31930', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Asuransi', 'ac5e6c59-24c1-47d9-b789-a8e4d0f31930', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Pajak & perizinan (izin klinik, retribusi)', 'ac5e6c59-24c1-47d9-b789-a8e4d0f31930', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
-- VARIABLE COST
('ATK & office supplies', '5a4e0845-11f9-43a6-86c1-0e1a85694e16', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Maintenance alat & gedung', '5a4e0845-11f9-43a6-86c1-0e1a85694e16', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Kebersihan/cleaning service', '5a4e0845-11f9-43a6-86c1-0e1a85694e16', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Transport operasional', '5a4e0845-11f9-43a6-86c1-0e1a85694e16', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
-- MARKETING & GROWTH
('Iklan digital (Meta/Google Ads)', 'a19623ef-2984-4ec1-8b18-a477aa839ea6', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Konten/foto-video', 'a19623ef-2984-4ec1-8b18-a477aa839ea6', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Promo/diskon pasien', 'a19623ef-2984-4ec1-8b18-a477aa839ea6', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Event/kerjasama komunitas', 'a19623ef-2984-4ec1-8b18-a477aa839ea6', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
-- DIGITAL APPS & SUBSCRIPTION
('Software klinik (kaffahphysio.id, dsb)', '3bf1792d-95bb-43a5-9abb-f7c754323978', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('WhatsApp Business API/blast', '3bf1792d-95bb-43a5-9abb-f7c754323978', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Akuntansi/payroll software', '3bf1792d-95bb-43a5-9abb-f7c754323978', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Cloud storage', '3bf1792d-95bb-43a5-9abb-f7c754323978', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
-- ENTERTAINMENT & CUSTOMER RELATION
('Jamuan tamu/rapat', 'dcad78ab-1801-4c55-81fd-adf00424929a', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Gift pasien/karyawan', 'dcad78ab-1801-4c55-81fd-adf00424929a', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
-- CAPITAL EXPENDITURE (CapEx)
('Alat fisioterapi baru (mesin, bed treatment)', 'd7069d0f-fa1e-47a1-a3c6-e89bff2bddf2', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Renovasi', 'd7069d0f-fa1e-47a1-a3c6-e89bff2bddf2', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Furniture/inventaris kantor', 'd7069d0f-fa1e-47a1-a3c6-e89bff2bddf2', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
-- BANK & FINANCE CHARGES
('Biaya admin bank', 'a9ee9eaa-eeed-446c-bc3f-6c0484b5db9c', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Biaya transfer/QRIS/EDC', 'a9ee9eaa-eeed-446c-bc3f-6c0484b5db9c', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Bunga pinjaman (jika ada)', 'a9ee9eaa-eeed-446c-bc3f-6c0484b5db9c', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
-- HR & PAYROLL COST
('Gaji pokok', 'b07b14d4-ee32-4cc0-a30f-d914a5625404', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('BPJS Kesehatan & Ketenagakerjaan', 'b07b14d4-ee32-4cc0-a30f-d914a5625404', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('THR/bonus', 'b07b14d4-ee32-4cc0-a30f-d914a5625404', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Training/sertifikasi fisioterapis', 'b07b14d4-ee32-4cc0-a30f-d914a5625404', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
-- TAX & LEGAL
('PPh 21/23', '6301c5b8-f558-4cbd-b9d1-bc02f040ebeb', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Biaya notaris/legal', '6301c5b8-f558-4cbd-b9d1-bc02f040ebeb', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
('Perizinan tahunan', '6301c5b8-f558-4cbd-b9d1-bc02f040ebeb', 'bfdc3fd8-a052-4753-a5b7-229930b3237a');
