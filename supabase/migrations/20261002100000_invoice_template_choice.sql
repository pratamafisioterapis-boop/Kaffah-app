-- Pilihan template invoice per klinik (hanya diubah super admin).
-- 'classic' = template lama (default), 'kwitansi' = template tabel bergaya kwitansi.
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS invoice_template text NOT NULL DEFAULT 'classic';

ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_invoice_template_check;
ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_invoice_template_check
  CHECK (invoice_template IN ('classic', 'kwitansi'));

-- Daftar item invoice (dipilih dari katalog harga) untuk template kwitansi.
-- Array of {category, name, qty, price, discount}. NULL = otomatis dari recap.
ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS invoice_items jsonb;
