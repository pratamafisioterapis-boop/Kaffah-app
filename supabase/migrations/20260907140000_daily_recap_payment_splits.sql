-- Fitur: split payment untuk daily recap.
-- Kasus: tagihan pasien 250rb, dibayar 200rb QRIS + 50rb cash. Sebelumnya
-- daily_recaps.payment_method hanya menampung satu metode per baris sehingga
-- kombinasi metode pembayaran tidak bisa dicatat.
--
-- daily_recaps.payment_method / amount / bank_account_id / fee_amount /
-- net_amount TETAP dipertahankan sebagai ringkasan (dipakai oleh trigger fee,
-- auto-assign paket, rekonsiliasi bank, dsb yang sudah ada) - kolom tersebut
-- diisi dengan metode dgn nominal terbesar saat split dipakai. Rincian per
-- metode disimpan di tabel anak ini untuk ditampilkan & dilaporkan.

CREATE TABLE IF NOT EXISTS public.daily_recap_payment_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recap_id uuid NOT NULL REFERENCES public.daily_recaps(id) ON DELETE CASCADE,
  payment_method text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_recap_payment_splits_recap_id
  ON public.daily_recap_payment_splits(recap_id);

ALTER TABLE public.daily_recap_payment_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_isolated_daily_recap_payment_splits
  ON public.daily_recap_payment_splits
  FOR ALL
  USING (
    get_my_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM public.daily_recaps r
      WHERE r.id = daily_recap_payment_splits.recap_id
        AND r.clinic_id = get_my_clinic_id()
    )
  )
  WITH CHECK (
    get_my_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM public.daily_recaps r
      WHERE r.id = daily_recap_payment_splits.recap_id
        AND r.clinic_id = get_my_clinic_id()
    )
  );

-- Total semua split untuk satu recap tidak boleh melebihi amount recap
-- tersebut (dicek longgar dengan toleransi 1 rupiah untuk pembulatan).
CREATE OR REPLACE FUNCTION public.validate_daily_recap_payment_splits()
RETURNS trigger AS $$
DECLARE
  v_recap_amount numeric;
  v_splits_total numeric;
BEGIN
  SELECT amount INTO v_recap_amount
  FROM public.daily_recaps
  WHERE id = COALESCE(NEW.recap_id, OLD.recap_id);

  SELECT COALESCE(SUM(amount), 0) INTO v_splits_total
  FROM public.daily_recap_payment_splits
  WHERE recap_id = COALESCE(NEW.recap_id, OLD.recap_id);

  IF v_recap_amount IS NOT NULL AND v_splits_total > (v_recap_amount + 1) THEN
    RAISE EXCEPTION 'Total split pembayaran (%) melebihi nominal recap (%)', v_splits_total, v_recap_amount;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_daily_recap_payment_splits ON public.daily_recap_payment_splits;
CREATE CONSTRAINT TRIGGER trg_validate_daily_recap_payment_splits
  AFTER INSERT OR UPDATE ON public.daily_recap_payment_splits
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.validate_daily_recap_payment_splits();
