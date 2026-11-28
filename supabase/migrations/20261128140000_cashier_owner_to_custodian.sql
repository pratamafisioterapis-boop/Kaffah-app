-- Aturan kasir Kaffah:
--  * Admin aktif yang menyimpan rekap setelah metode pembayaran terisi (terapi
--    nominal > 0, atau barang bernominal > 0 dengan metode barang) menjadi kasir.
--  * Bila yang menyimpan owner, kasirnya admin pemegang kas utama
--    (cash_ledger_config.custodian_user_id), selama pemegang itu admin aktif.
--  * Hanya terisi bila cashier_id masih kosong.
CREATE OR REPLACE FUNCTION public.set_cashier_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_role text;
  v_cust uuid;
BEGIN
  IF NEW.cashier_id IS NOT NULL OR v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT (
       (COALESCE(NEW.amount, 0) > 0
        AND NULLIF(btrim(COALESCE(NEW.payment_method, '')), '') IS NOT NULL)
    OR (COALESCE(NEW.goods_amount, 0) > 0
        AND NULLIF(btrim(COALESCE(NEW.goods_payment_method, '')), '') IS NOT NULL)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT c.custodian_user_id INTO v_cust
  FROM public.cash_ledger_config c WHERE c.clinic_id = NEW.clinic_id;
  IF NOT FOUND THEN
    RETURN NEW;  -- klinik tanpa pencatatan cash
  END IF;

  SELECT u.role INTO v_role
  FROM public.users u
  WHERE u.id = v_uid AND u.clinic_id = NEW.clinic_id AND COALESCE(u.is_active, true);

  IF v_role = 'admin' THEN
    NEW.cashier_id := v_uid;
  ELSIF v_role = 'owner' AND v_cust IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.users u
                    WHERE u.id = v_cust AND u.role = 'admin'
                      AND u.clinic_id = NEW.clinic_id AND COALESCE(u.is_active, true)) THEN
    NEW.cashier_id := v_cust;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.set_cashier_on_payment() FROM PUBLIC, anon, authenticated;
