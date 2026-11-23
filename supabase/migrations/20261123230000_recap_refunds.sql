-- Refund kelebihan bayar atas recap yang SUDAH berinvoice (mis. pasien pelajar yang
-- seharusnya mendapat promo tetapi sudah membayar harga normal).
--
-- Prinsip pembukuan:
--   * Recap & invoice TIDAK diubah (nominal terkunci setelah invoice) -> omzet tercatat apa adanya.
--   * Uang yang dikembalikan dicatat sebagai PENGELUARAN (admin_expenses) kategori "REFUND PASIEN"
--     pada rekening/kas sumber pembayaran refund -> saldo rekening (bank_account_balances),
--     laporan pengeluaran, dan laba bersih otomatis ikut benar.
--   * Setiap refund punya baris di recap_refunds (siapa, kapan, alasan, dari rekening mana,
--     tertaut ke baris pengeluaran) sebagai jejak audit. Hanya owner yang boleh melakukan refund.
--   * Total refund per recap tidak boleh melebihi nominal yang dibayar pasien.

CREATE TABLE IF NOT EXISTS public.recap_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  recap_id uuid NOT NULL,
  patient_id uuid,
  patient_name text,
  receipt_number text,
  recap_date date,
  amount_paid numeric NOT NULL,
  refund_amount numeric NOT NULL CHECK (refund_amount > 0),
  reason text NOT NULL,
  bank_account_id uuid,
  bank_account_name text,
  refund_date date NOT NULL,
  expense_id uuid,
  refunded_by uuid,
  refunded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recap_refunds_recap ON public.recap_refunds (recap_id);
CREATE INDEX IF NOT EXISTS idx_recap_refunds_clinic ON public.recap_refunds (clinic_id, refunded_at DESC);

ALTER TABLE public.recap_refunds ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'recap_refunds' AND policyname = 'Staff read own clinic recap refunds') THEN
    CREATE POLICY "Staff read own clinic recap refunds" ON public.recap_refunds
      FOR SELECT TO authenticated
      USING (clinic_id = (SELECT public.get_my_clinic_id())
             AND (SELECT public.get_my_role()) IN ('owner', 'super_admin', 'admin', 'clinic_admin'));
  END IF;
END $$;

-- Tulis hanya lewat fungsi di bawah (tanpa policy INSERT/UPDATE/DELETE untuk klien).

CREATE OR REPLACE FUNCTION public.refund_recap_overpayment(
  p_recap_id uuid,
  p_amount numeric,
  p_reason text,
  p_bank_account_id uuid,
  p_refund_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_role text := get_my_role();
  v_clinic uuid := get_my_clinic_id();
  r daily_recaps;
  v_paid numeric;
  v_done numeric;
  v_patient_name text;
  v_bank_name text;
  v_cat_id uuid;
  v_sub_id uuid;
  v_exp_id uuid;
  v_refund_id uuid;
  v_date date := COALESCE(p_refund_date, (now() AT TIME ZONE 'Asia/Makassar')::date);
  v_petty boolean;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('owner', 'super_admin') THEN
    RAISE EXCEPTION 'Hanya owner yang dapat melakukan refund.' USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal refund harus lebih dari 0.';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Alasan refund wajib diisi (minimal 5 karakter).';
  END IF;
  IF p_bank_account_id IS NULL THEN
    RAISE EXCEPTION 'Pilih rekening/kas sumber pembayaran refund.';
  END IF;

  SELECT * INTO r FROM daily_recaps WHERE id = p_recap_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recap tidak ditemukan.';
  END IF;
  IF v_role <> 'super_admin' AND r.clinic_id IS DISTINCT FROM v_clinic THEN
    RAISE EXCEPTION 'Recap bukan milik klinik Anda.' USING ERRCODE = '42501';
  END IF;
  IF r.invoice_created_at IS NULL THEN
    RAISE EXCEPTION 'Recap belum berinvoice/belum dibayar. Koreksi nominal langsung di recap, bukan lewat refund.';
  END IF;

  v_paid := COALESCE(r.amount, 0);
  SELECT COALESCE(SUM(refund_amount), 0) INTO v_done FROM recap_refunds WHERE recap_id = r.id;
  IF p_amount > v_paid - v_done THEN
    RAISE EXCEPTION 'Refund melebihi sisa yang bisa dikembalikan (dibayar Rp %, sudah direfund Rp %).',
      to_char(v_paid, 'FM999G999G999'), to_char(v_done, 'FM999G999G999');
  END IF;

  SELECT bank_name INTO v_bank_name FROM bank_accounts
  WHERE id = p_bank_account_id AND clinic_id = r.clinic_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rekening/kas tidak ditemukan di klinik ini.';
  END IF;
  v_petty := v_bank_name ~* '(cash|tunai)';

  SELECT full_name INTO v_patient_name FROM patients WHERE id = COALESCE(r.actual_patient_id, r.patient_id);

  -- Kategori pengeluaran khusus refund (dibuat otomatis bila belum ada).
  SELECT id INTO v_cat_id FROM accounting_categories
  WHERE clinic_id = r.clinic_id AND category_name = 'REFUND PASIEN' AND type = 'expense' LIMIT 1;
  IF v_cat_id IS NULL THEN
    INSERT INTO accounting_categories (category_name, type, clinic_id)
    VALUES ('REFUND PASIEN', 'expense', r.clinic_id) RETURNING id INTO v_cat_id;
  END IF;
  SELECT id INTO v_sub_id FROM accounting_subcategories
  WHERE clinic_id = r.clinic_id AND category_id = v_cat_id AND subcategory_name = 'Refund kelebihan bayar / koreksi promo' LIMIT 1;
  IF v_sub_id IS NULL THEN
    INSERT INTO accounting_subcategories (category_id, subcategory_name, clinic_id)
    VALUES (v_cat_id, 'Refund kelebihan bayar / koreksi promo', r.clinic_id) RETURNING id INTO v_sub_id;
  END IF;

  INSERT INTO admin_expenses (
    amount, category, sub_category, sub_category_id, description, transaction_date,
    created_by, bank_account_id, clinic_id, paid_from_petty
  ) VALUES (
    p_amount, 'REFUND PASIEN', 'Refund kelebihan bayar / koreksi promo', v_sub_id,
    'Refund ' || COALESCE(v_patient_name, 'pasien') || ' (' || COALESCE(r.receipt_number, 'tanpa no. kwitansi')
      || ', terapi ' || to_char(r.recap_date, 'DD-MM-YYYY') || '): ' || btrim(p_reason),
    v_date, auth.uid(), p_bank_account_id, r.clinic_id, v_petty
  ) RETURNING id INTO v_exp_id;

  INSERT INTO recap_refunds (
    clinic_id, recap_id, patient_id, patient_name, receipt_number, recap_date, amount_paid,
    refund_amount, reason, bank_account_id, bank_account_name, refund_date, expense_id, refunded_by
  ) VALUES (
    r.clinic_id, r.id, COALESCE(r.actual_patient_id, r.patient_id), v_patient_name, r.receipt_number, r.recap_date, v_paid,
    p_amount, btrim(p_reason), p_bank_account_id, v_bank_name, v_date, v_exp_id, auth.uid()
  ) RETURNING id INTO v_refund_id;

  RETURN jsonb_build_object(
    'refund_id', v_refund_id,
    'expense_id', v_exp_id,
    'refund_amount', p_amount,
    'remaining_refundable', v_paid - v_done - p_amount
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.refund_recap_overpayment(uuid, numeric, text, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_recap_overpayment(uuid, numeric, text, uuid, date) TO authenticated;
