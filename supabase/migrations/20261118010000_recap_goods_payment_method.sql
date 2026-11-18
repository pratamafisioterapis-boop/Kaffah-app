-- ---------------------------------------------------------------------------
-- Metode bayar khusus barang di recap sesi paket (Rp 0).
--
-- Sesi lanjutan paket berstatus metode 'Package' (bukan pembayaran riil), tapi
-- pasien bisa membeli barang klinik di hari yang sama. Barang itu dibayar
-- tunai/QRIS/transfer sungguhan, jadi butuh metode sendiri.
--
-- goods_payment_method: NULL = barang mengikuti daily_recaps.payment_method
-- (perilaku lama). Terisi hanya bila recap bermetode 'Package'.
-- ---------------------------------------------------------------------------
ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS goods_payment_method text;

-- Cash kasir: bagian barang mengikuti goods_payment_method bila ada.
CREATE OR REPLACE FUNCTION public.recap_cash_amount(p_recap public.daily_recaps)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM public.daily_recap_payment_splits s WHERE s.recap_id = p_recap.id)
        THEN COALESCE((
          SELECT SUM(s.amount) FROM public.daily_recap_payment_splits s
          WHERE s.recap_id = p_recap.id
            AND lower(btrim(s.payment_method)) IN ('cash', 'tunai')
        ), 0)
      WHEN lower(btrim(COALESCE(p_recap.payment_method, ''))) IN ('cash', 'tunai')
        THEN COALESCE(p_recap.amount, 0)
      ELSE 0
    END
    + CASE
        WHEN lower(btrim(COALESCE(NULLIF(btrim(p_recap.goods_payment_method), ''), p_recap.payment_method, ''))) IN ('cash', 'tunai')
          THEN COALESCE(p_recap.goods_amount, 0)
        ELSE 0
      END;
$$;
REVOKE ALL ON FUNCTION public.recap_cash_amount(public.daily_recaps) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recap_cash_amount(public.daily_recaps) TO authenticated;
