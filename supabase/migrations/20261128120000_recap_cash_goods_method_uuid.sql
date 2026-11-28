-- ---------------------------------------------------------------------------
-- Perbaikan: barang di sesi paket yang dibayar cash tidak masuk "Cash Dipegang".
--
-- Form recap menyimpan daily_recaps.goods_payment_method sebagai ID opsi
-- (operational_options.id, UUID), bukan label seperti 'Cash'. recap_cash_amount
-- membandingkan langsung dengan 'cash'/'tunai', jadi UUID tidak pernah cocok
-- dan penjualan barang cash (mis. kinesiotape Rp 50.000 pasien paket) tidak
-- terhitung sebagai cash yang dipegang admin.
--
-- Solusi: terjemahkan UUID ke label lewat operational_options sebelum dicocokkan.
-- Nilai yang sudah berupa label tetap dipakai apa adanya.
-- ---------------------------------------------------------------------------
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
        WHEN lower(btrim(COALESCE(
               (SELECT o.label FROM public.operational_options o
                 WHERE o.id::text = btrim(p_recap.goods_payment_method)
                 LIMIT 1),
               NULLIF(btrim(p_recap.goods_payment_method), ''),
               p_recap.payment_method,
               ''))) IN ('cash', 'tunai')
          THEN COALESCE(p_recap.goods_amount, 0)
        ELSE 0
      END;
$$;
REVOKE ALL ON FUNCTION public.recap_cash_amount(public.daily_recaps) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recap_cash_amount(public.daily_recaps) TO authenticated;
