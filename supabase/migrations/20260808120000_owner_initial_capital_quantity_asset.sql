-- Add quantity tracking and fixed-asset classification to owner_initial_capital.
-- "Aset Tetap" = item still has resale value (dijual kembali) vs a regular
-- expense/consumable that has none once purchased.
ALTER TABLE public.owner_initial_capital
  ADD COLUMN IF NOT EXISTS quantity numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_fixed_asset boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estimated_resale_value numeric;

COMMENT ON COLUMN public.owner_initial_capital.quantity IS 'Jumlah unit barang yang dibeli dengan modal ini.';
COMMENT ON COLUMN public.owner_initial_capital.is_fixed_asset IS 'True jika barang diklasifikasikan sebagai Aset Tetap (masih punya nilai jual kembali).';
COMMENT ON COLUMN public.owner_initial_capital.estimated_resale_value IS 'Estimasi nilai jual kembali per unit, opsional, hanya relevan jika is_fixed_asset = true.';
