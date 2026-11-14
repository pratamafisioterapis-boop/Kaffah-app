-- Bukti pembayaran (foto/screenshot) untuk daily recap yang dibayar via
-- debit / transfer. Validasi "wajib" ada di form (DailyRecapModal); DB hanya
-- menyimpan path-nya agar recap lama tetap valid.
--  * daily_recaps.payment_proof_path            : bukti untuk pembayaran 1 metode
--  * daily_recap_payment_splits.proof_path      : bukti per baris split
-- Bucket privat; path: {clinic_id}/{uuid}.{ext}

ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS payment_proof_path text;

ALTER TABLE public.daily_recap_payment_splits
  ADD COLUMN IF NOT EXISTS proof_path text;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('payment-proofs', 'payment-proofs', false, 5242880)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS payment_proofs_staff_write ON storage.objects;
CREATE POLICY payment_proofs_staff_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND get_my_role() IN ('owner', 'admin', 'super_admin')
    AND (storage.foldername(name))[1] = get_my_clinic_id()::text
  );

DROP POLICY IF EXISTS payment_proofs_staff_read ON storage.objects;
CREATE POLICY payment_proofs_staff_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (
      get_my_role() = 'super_admin'
      OR (
        get_my_role() IN ('owner', 'admin')
        AND (storage.foldername(name))[1] = get_my_clinic_id()::text
      )
    )
  );

DROP POLICY IF EXISTS payment_proofs_staff_delete ON storage.objects;
CREATE POLICY payment_proofs_staff_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND get_my_role() IN ('owner', 'admin', 'super_admin')
    AND (storage.foldername(name))[1] = get_my_clinic_id()::text
  );
