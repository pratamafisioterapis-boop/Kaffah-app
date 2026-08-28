-- Surat Peringatan bisa mencakup lebih dari satu tanggal pelanggaran
-- sekaligus (jenis pelanggaran boleh berbeda atau sama untuk tiap tanggal).
-- violation_date/violation_description tetap dipertahankan sebagai ringkasan
-- (tanggal pelanggaran paling awal & gabungan uraian) supaya laporan bulanan
-- & kode lama yang membaca kedua kolom itu tidak perlu diubah.
ALTER TABLE therapist_warning_letters
  ADD COLUMN violations jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE therapist_warning_letters
SET violations = jsonb_build_array(
  jsonb_build_object('date', violation_date, 'description', violation_description)
)
WHERE violations = '[]'::jsonb;
