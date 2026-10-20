-- Nominal > 0 wajib punya metode pembayaran (kecuali pasien Free).
-- Berlaku juga untuk Recovery di luar paket: saat di-flag, payment_method=NULL dan
-- amount=0 (recovery_outside_package_apply), jadi baru kena aturan ini begitu nominal terisi.
--
-- Dipasang sebagai trigger (bukan CHECK constraint) supaya baris lama yang sudah melanggar
-- tidak menggagalkan UPDATE massal (cron/trigger lain). Aturan hanya diperiksa saat INSERT
-- atau saat amount / payment_method / special_type berubah.
CREATE OR REPLACE FUNCTION public.enforce_payment_method_when_amount()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_new_method text := NULLIF(btrim(COALESCE(NEW.payment_method, '')), '');
BEGIN
  IF COALESCE(NEW.amount, 0) > 0
     AND v_new_method IS NULL
     AND NEW.special_type IS DISTINCT FROM 'free' THEN
    IF TG_OP = 'INSERT'
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR v_new_method IS DISTINCT FROM NULLIF(btrim(COALESCE(OLD.payment_method, '')), '')
       OR NEW.special_type IS DISTINCT FROM OLD.special_type THEN
      RAISE EXCEPTION 'Metode pembayaran wajib diisi bila nominal lebih dari 0.' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_payment_method_when_amount() FROM PUBLIC, anon, authenticated;

-- Nama berawalan "zzz" agar jalan paling akhir, setelah trigger lain selesai mengisi amount/metode.
DROP TRIGGER IF EXISTS zzz_require_payment_method ON public.daily_recaps;
CREATE TRIGGER zzz_require_payment_method
  BEFORE INSERT OR UPDATE ON public.daily_recaps
  FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_method_when_amount();

-- Baris lama yang masih perlu dilengkapi admin:
--   SELECT id, recap_date, patient_id, amount
--   FROM public.daily_recaps
--   WHERE COALESCE(amount, 0) > 0
--     AND NULLIF(btrim(COALESCE(payment_method, '')), '') IS NULL
--     AND special_type IS DISTINCT FROM 'free';
