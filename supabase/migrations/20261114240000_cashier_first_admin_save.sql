-- Aturan kasir: admin yang menyimpan rekap SETELAH metode pembayaran terpilih (nominal > 0)
-- menjadi kasir, bila cashier_id masih kosong. Tidak lagi mensyaratkan metode/nominal berubah
-- pada simpanan itu (mis. metode sudah diisi lebih dulu, lalu admin menyimpan).
-- Hanya akun ber-role admin klinik yang aktif: terapis & owner juga sering menyimpan rekap
-- (SOAP, koreksi) tetapi bukan penerima uang.
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

-- Isi kasir semua rekap (semua metode bayar) sejak tanggal mulai yang masih kosong:
-- admin pertama yang menyimpan rekap setelah pembayaran terisi (dari jejak audit).
UPDATE public.daily_recaps r
   SET cashier_id = x.uid
  FROM (
    SELECT DISTINCT ON (a.resource_id) a.resource_id::uuid AS rid, a.user_id AS uid
    FROM public.audit_logs a
    JOIN public.users u ON u.id = a.user_id AND u.role = 'admin' AND COALESCE(u.is_active, true)
    WHERE a.resource_type = 'daily_recaps' AND a.action = 'UPDATE'
      AND NULLIF(btrim(COALESCE(a.changes->'new'->>'payment_method', '')), '') IS NOT NULL
      AND COALESCE(NULLIF(a.changes->'new'->>'amount', '')::numeric, 0) > 0
    ORDER BY a.resource_id, a.created_at
  ) x
 WHERE r.id = x.rid
   AND r.cashier_id IS NULL
   AND r.clinic_id IN (SELECT clinic_id FROM public.cash_ledger_config)
   AND COALESCE(r.revenue_date, r.recap_date) >= (SELECT c.start_date FROM public.cash_ledger_config c WHERE c.clinic_id = r.clinic_id);
