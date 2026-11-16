-- Kasir otomatis untuk klinik yang memakai pencatatan cash (Kaffah).
--
-- Sebelumnya cashier_id hanya diisi aplikasi untuk klinik Praxis (isKwitansi), sehingga
-- cash rekap Kaffah tidak masuk saldo admin mana pun. Sekarang trigger mengisi
-- cashier_id = admin yang pertama kali mengisi/mengubah pembayaran rekap (metode & nominal),
-- hanya bila cashier_id masih kosong. Trigger diberi nama "zzzz" agar jalan terakhir,
-- setelah trigger lain selesai menetapkan amount/payment_method.
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
     AND COALESCE(NEW.amount, 0) > 0
     AND NULLIF(btrim(COALESCE(NEW.payment_method, '')), '') IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR OLD.payment_method IS DISTINCT FROM NEW.payment_method
          OR OLD.amount IS DISTINCT FROM NEW.amount)
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

DROP TRIGGER IF EXISTS zzzz_set_cashier_on_payment ON public.daily_recaps;
CREATE TRIGGER zzzz_set_cashier_on_payment
  BEFORE INSERT OR UPDATE ON public.daily_recaps
  FOR EACH ROW EXECUTE FUNCTION public.set_cashier_on_payment();

-- Isi kasir untuk rekap cash sejak tanggal mulai yang masih kosong: admin pertama yang
-- mengubah pembayaran (dari jejak audit).
UPDATE public.daily_recaps r
   SET cashier_id = x.uid
  FROM (
    SELECT DISTINCT ON (a.resource_id) a.resource_id::uuid AS rid, a.user_id AS uid
    FROM public.audit_logs a
    JOIN public.users u ON u.id = a.user_id AND u.role = 'admin' AND COALESCE(u.is_active, true)
    WHERE a.resource_type = 'daily_recaps' AND a.action = 'UPDATE'
      AND ((a.changes->'old'->>'payment_method') IS DISTINCT FROM (a.changes->'new'->>'payment_method')
           OR (a.changes->'old'->>'amount') IS DISTINCT FROM (a.changes->'new'->>'amount'))
      AND NULLIF(btrim(COALESCE(a.changes->'new'->>'payment_method', '')), '') IS NOT NULL
    ORDER BY a.resource_id, a.created_at
  ) x
 WHERE r.id = x.rid
   AND r.cashier_id IS NULL
   AND r.clinic_id IN (SELECT clinic_id FROM public.cash_ledger_config)
   AND COALESCE(r.revenue_date, r.recap_date) >= (SELECT c.start_date FROM public.cash_ledger_config c WHERE c.clinic_id = r.clinic_id)
   AND public.recap_cash_amount(r) > 0;
