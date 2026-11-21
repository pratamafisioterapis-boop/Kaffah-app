-- Praxis: pembayaran paket tidak boleh hilang saat rekap pembawanya dihapus.
--
-- Pembelian paket saat kunjungan dicatat sebagai nominal penuh pada satu baris daily_recaps
-- (sesi lain = 0). Jika baris itu dihapus (langsung, atau cascade dari penghapusan appointment),
-- uang masuknya hilang dari pembukuan (kasus 12 & 15 Nov 2026).
--
-- Pengaman: sebelum baris dihapus, bila ia satu-satunya pembawa pembayaran untuk paketnya,
-- nominalnya disalin ke package_payments (tanggal bayar = revenue_date, nomor kwitansi = nomor
-- rekap). Penghapusan tetap berjalan. Bila memang salah input, owner dapat membatalkan
-- pembayaran itu (status void) dari Package Recaps.

CREATE OR REPLACE FUNCTION public.praxis_preserve_package_payment_on_recap_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c_praxis constant uuid := 'b25e8c29-6977-4e1b-b500-7629ec3aeb8a';
  v_patient uuid := COALESCE(OLD.actual_patient_id, OLD.patient_id);
  v_pkg package_tracking;
  v_receipt text;
  v_seq integer;
  v_day date := COALESCE(OLD.revenue_date, OLD.recap_date);
BEGIN
  IF OLD.clinic_id IS DISTINCT FROM c_praxis
     OR OLD.package_tracking_id IS NULL
     OR COALESCE(OLD.amount, 0) <= 0
     OR lower(COALESCE(OLD.payment_method, '')) IN ('', 'package')
     OR v_patient IS NULL THEN
    RETURN OLD;
  END IF;

  -- Pembayaran paket ini sudah tercatat di tempat lain (payments atau baris rekap lain)?
  IF EXISTS (SELECT 1 FROM package_payments pp
             WHERE pp.package_tracking_id = OLD.package_tracking_id AND pp.status = 'paid')
     OR EXISTS (SELECT 1 FROM daily_recaps d
                WHERE d.package_tracking_id = OLD.package_tracking_id
                  AND d.id <> OLD.id AND COALESCE(d.amount, 0) > 0) THEN
    RETURN OLD;
  END IF;

  SELECT * INTO v_pkg FROM package_tracking WHERE id = OLD.package_tracking_id;

  v_receipt := OLD.receipt_number;
  IF v_receipt IS NULL OR EXISTS (SELECT 1 FROM package_payments
                                  WHERE clinic_id = c_praxis AND receipt_number = v_receipt) THEN
    PERFORM pg_advisory_xact_lock(hashtext('praxis_package_receipt_KWT/' || to_char(v_day, 'YYYYMMDD')));
    SELECT COUNT(*) + 1 INTO v_seq FROM package_payments
    WHERE clinic_id = c_praxis AND receipt_number LIKE 'KWT/' || to_char(v_day, 'YYYYMMDD') || '/%';
    v_receipt := 'KWT/' || to_char(v_day, 'YYYYMMDD') || '/' || lpad(v_seq::text, 3, '0');
  END IF;

  INSERT INTO package_payments (
    clinic_id, patient_id, package_tracking_id, package_name, total_sessions, amount,
    payment_method, bank_account_id, paid_at, receipt_number, cashier_id, status
  ) VALUES (
    c_praxis, v_patient, v_pkg.id,
    COALESCE(v_pkg.package_name, OLD.package_type, 'Paket'),
    COALESCE(v_pkg.total_sessions, 1),
    OLD.amount, OLD.payment_method, OLD.bank_account_id,
    ((v_day::text || ' 12:00:00+08')::timestamptz),
    v_receipt, OLD.cashier_id, 'paid'
  );

  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.praxis_preserve_package_payment_on_recap_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_praxis_preserve_package_payment ON public.daily_recaps;
CREATE TRIGGER trg_praxis_preserve_package_payment
  BEFORE DELETE ON public.daily_recaps
  FOR EACH ROW
  WHEN (OLD.package_tracking_id IS NOT NULL AND OLD.amount > 0)
  EXECUTE FUNCTION public.praxis_preserve_package_payment_on_recap_delete();
