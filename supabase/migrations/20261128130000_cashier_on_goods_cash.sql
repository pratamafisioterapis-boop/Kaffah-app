-- Kasir untuk sesi paket (nominal terapi Rp 0) yang punya penjualan barang cash.
-- Sebelumnya set_cashier_on_payment hanya aktif bila amount > 0, sehingga recap
-- sesi paket dengan barang dibayar cash tidak pernah punya kasir dan cash-nya
-- tidak muncul di "Cash Dipegang" admin mana pun.
CREATE OR REPLACE FUNCTION public.set_cashier_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NEW.cashier_id IS NULL
     AND v_uid IS NOT NULL
     AND (
       (COALESCE(NEW.amount, 0) > 0
        AND NULLIF(btrim(COALESCE(NEW.payment_method, '')), '') IS NOT NULL)
       OR
       (COALESCE(NEW.goods_amount, 0) > 0
        AND NULLIF(btrim(COALESCE(NEW.goods_payment_method, '')), '') IS NOT NULL)
     )
     AND EXISTS (SELECT 1 FROM public.cash_ledger_config c WHERE c.clinic_id = NEW.clinic_id)
     AND EXISTS (SELECT 1 FROM public.users u
                 WHERE u.id = v_uid AND u.role = 'admin' AND u.clinic_id = NEW.clinic_id
                   AND COALESCE(u.is_active, true)) THEN
    NEW.cashier_id := v_uid;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.set_cashier_on_payment() FROM PUBLIC, anon, authenticated;

-- Isi kasir recap lama: admin pertama yang menyimpan rekap setelah barang + metodenya terisi.
UPDATE public.daily_recaps r
   SET cashier_id = x.uid
  FROM (
    SELECT DISTINCT ON (a.resource_id) a.resource_id::uuid AS rid, a.user_id AS uid
    FROM public.audit_logs a
    JOIN public.users u ON u.id = a.user_id AND u.role = 'admin' AND COALESCE(u.is_active, true)
    WHERE a.resource_type = 'daily_recaps' AND a.action = 'UPDATE'
      AND NULLIF(btrim(COALESCE(a.changes->'new'->>'goods_payment_method', '')), '') IS NOT NULL
      AND COALESCE(NULLIF(a.changes->'new'->>'goods_amount', '')::numeric, 0) > 0
    ORDER BY a.resource_id, a.created_at
  ) x
 WHERE r.id = x.rid
   AND r.cashier_id IS NULL
   AND r.clinic_id IN (SELECT clinic_id FROM public.cash_ledger_config)
   AND COALESCE(r.revenue_date, r.recap_date) >= (SELECT c.start_date FROM public.cash_ledger_config c WHERE c.clinic_id = r.clinic_id);
