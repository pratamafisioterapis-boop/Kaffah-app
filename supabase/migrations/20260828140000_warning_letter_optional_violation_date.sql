-- Tanggal kejadian pelanggaran sekarang opsional (owner boleh hanya
-- menjelaskan pelanggarannya saja tanpa tanggal pasti), jadi violation_date
-- tidak lagi wajib diisi.
ALTER TABLE therapist_warning_letters
  ALTER COLUMN violation_date DROP NOT NULL;
