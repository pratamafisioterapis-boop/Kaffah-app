-- Jam buka klinik per hari, diatur owner di Settings. Dipakai form izin terapis untuk
-- membatasi jam izin dan jam pengganti.
-- Bentuk: {"0": {"enabled": true, "start": "09:00", "end": "17:00"}, ... "6": {...}}
-- (0 = Minggu ... 6 = Sabtu). NULL = belum diatur, aplikasi memakai jam bawaan
-- sehingga perilaku klinik yang belum menyimpan apa pun tidak berubah.
-- File ini hanya menambah kolom (tanpa DROP), aman dijalankan lewat apply_migration.

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS operating_hours jsonb;
