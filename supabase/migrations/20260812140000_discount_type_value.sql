-- Add discount value type (nominal/percentage) and default value to operational_options,
-- so each "Jenis Diskon" carries its own default discount that transactions can reuse
-- instead of requiring the amount to be re-entered manually every time.
ALTER TABLE public.operational_options
  ADD COLUMN IF NOT EXISTS discount_value_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric;

ALTER TABLE public.operational_options
  DROP CONSTRAINT IF EXISTS operational_options_discount_value_type_check;

ALTER TABLE public.operational_options
  ADD CONSTRAINT operational_options_discount_value_type_check
  CHECK (discount_value_type IS NULL OR discount_value_type IN ('nominal', 'percentage'));
