-- Kasir invoice = admin yang pertama kali menyimpan rekap (bukan siapa pun yang
-- memicu trigger pembuatan baris recap, yang tercatat di created_by).
-- Diisi sekali oleh aplikasi; tidak berubah saat admin lain merevisi.
ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS cashier_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_daily_recaps_cashier_id ON public.daily_recaps (cashier_id);
COMMENT ON COLUMN public.daily_recaps.cashier_id IS 'Admin/kasir yang pertama kali menyimpan rekap; diisi sekali oleh aplikasi dan tidak berubah saat admin lain merevisi.';
