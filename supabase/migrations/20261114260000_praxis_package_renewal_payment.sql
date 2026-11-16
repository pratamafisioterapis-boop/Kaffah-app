-- Perpanjangan paket Praxis dari halaman Package Recaps.
--
-- Pembayaran perpanjangan dicatat SENDIRI (package_payments), tidak lewat daily_recaps:
-- rekap harian dianggap sebuah kunjungan (daftar harian, statistik/insentif terapis, pesan WA
-- follow-up), padahal perpanjangan hanya pembayaran + kwitansi. Paket baru langsung dibuat
-- 'aktif' dengan sesi_terpakai = 0; sesi baru terhitung saat pasien datang (rekap kunjungan
-- biasa tertaut otomatis lewat auto_assign_package_on_insert, atau lewat form rekap).
--
-- Masa berlaku paket dihitung dari SESI PERTAMA (bukan dari tanggal bayar). Selama belum
-- dipakai, start_date = tanggal bayar dan end_date = batas aktivasi 1 tahun (penampung, supaya
-- trigger auto-assign & form rekap tetap mengenali paket sebagai aktif); saat rekap pertama
-- tertaut, trigger di bawah mengisi start_date/end_date/first_used_at yang sebenarnya.

-- 1. Penanda paket yang dibeli lewat perpanjangan ---------------------------------------
ALTER TABLE public.package_tracking
  ADD COLUMN IF NOT EXISTS purchase_payment_id uuid;

-- 2. Tabel pembayaran perpanjangan --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.package_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           uuid NOT NULL REFERENCES public.clinics(id),
  patient_id          uuid NOT NULL REFERENCES public.patients(id),
  package_tracking_id uuid REFERENCES public.package_tracking(id) ON DELETE SET NULL,
  previous_package_id uuid,
  package_name        text NOT NULL,
  total_sessions      integer NOT NULL,
  amount              numeric NOT NULL CHECK (amount > 0),
  payment_method      text NOT NULL,
  bank_account_id     uuid,
  paid_at             timestamptz NOT NULL DEFAULT now(),
  receipt_number      text NOT NULL,
  cashier_id          uuid,
  created_by          uuid DEFAULT auth.uid(),
  status              text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'void')),
  void_reason         text,
  voided_at           timestamptz,
  voided_by           uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS package_payments_receipt_uidx
  ON public.package_payments (clinic_id, receipt_number);
CREATE INDEX IF NOT EXISTS package_payments_patient_idx
  ON public.package_payments (patient_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS package_payments_package_idx
  ON public.package_payments (package_tracking_id);

ALTER TABLE public.package_payments ENABLE ROW LEVEL SECURITY;

-- Baca: sesama klinik. Tulis: hanya lewat fungsi di bawah (tanpa policy INSERT/UPDATE/DELETE).
DROP POLICY IF EXISTS package_payments_select ON public.package_payments;
CREATE POLICY package_payments_select ON public.package_payments
  FOR SELECT TO authenticated
  USING (clinic_id = get_my_clinic_id() OR get_my_role() = 'super_admin');

REVOKE ALL ON public.package_payments FROM PUBLIC, anon;
GRANT SELECT ON public.package_payments TO authenticated;

-- 3. Catat perpanjangan paket ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.praxis_renew_package(
  p_patient_id uuid,
  p_package_label text,
  p_payment_method text,
  p_amount numeric
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c_praxis constant uuid := 'b25e8c29-6977-4e1b-b500-7629ec3aeb8a';
  v_role text := get_my_role();
  v_clinic uuid := get_my_clinic_id();
  v_today date := (now() AT TIME ZONE 'Asia/Makassar')::date;
  v_patient patients;
  v_pkg operational_options;
  v_pm_label text;
  v_pm_bank uuid;
  v_prev_id uuid;
  v_pkg_id uuid := gen_random_uuid();
  v_pay_id uuid := gen_random_uuid();
  v_prefix text;
  v_seq integer;
  v_receipt text;
  v_cashier uuid;
  v_validity integer;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin', 'clinic_admin', 'owner', 'super_admin') THEN
    RAISE EXCEPTION 'Anda tidak punya izin untuk mencatat perpanjangan paket.' USING ERRCODE = '42501';
  END IF;
  IF v_role <> 'super_admin' AND v_clinic IS DISTINCT FROM c_praxis THEN
    RAISE EXCEPTION 'Fitur ini khusus klinik Praxis.' USING ERRCODE = '42501';
  END IF;

  -- Kunci baris pasien: mencegah dua pembayaran bersamaan (klik ganda / dua admin).
  SELECT * INTO v_patient FROM patients WHERE id = p_patient_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pasien tidak ditemukan.';
  END IF;
  IF v_patient.clinic_id IS DISTINCT FROM c_praxis THEN
    RAISE EXCEPTION 'Pasien bukan milik klinik Praxis.' USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pembayaran wajib diisi (lebih dari 0).';
  END IF;

  SELECT * INTO v_pkg FROM operational_options o
  WHERE o.clinic_id = c_praxis AND o.category = 'tipe_paket'
    AND COALESCE(o.is_active, true)
    AND lower(o.label) = lower(btrim(p_package_label))
  LIMIT 1;
  IF NOT FOUND OR COALESCE(v_pkg.session_count, 0) <= 1 THEN
    RAISE EXCEPTION 'Paket "%" tidak ditemukan.', p_package_label;
  END IF;

  -- Paket sebelumnya harus sudah habis. Paket yang sesinya sudah 0 tetapi statusnya belum
  -- berganti ditutup di sini; paket yang masih punya sisa sesi menolak perpanjangan.
  IF EXISTS (
    SELECT 1 FROM package_tracking pt
    WHERE pt.patient_id = p_patient_id
      AND pt.status IN ('aktif', 'pending', 'diperpanjang')
      AND COALESCE(pt.sessions_remaining, pt.total_sessions - COALESCE(pt.sessions_used, 0)) > 0
  ) THEN
    RAISE EXCEPTION 'Pasien masih memiliki paket aktif dengan sisa sesi. Perpanjangan hanya setelah sesi paket habis.';
  END IF;

  SELECT pt.id INTO v_prev_id FROM package_tracking pt
  WHERE pt.patient_id = p_patient_id
  ORDER BY pt.created_at DESC LIMIT 1;

  UPDATE package_tracking
  SET status = 'selesai', updated_at = now()
  WHERE patient_id = p_patient_id AND status IN ('aktif', 'diperpanjang');

  SELECT o.label, o.bank_account_id INTO v_pm_label, v_pm_bank
  FROM operational_options o
  WHERE o.clinic_id = c_praxis AND o.category = 'payment_method'
    AND COALESCE(o.is_active, true)
    AND lower(o.label) = lower(btrim(p_payment_method))
    AND lower(o.label) <> 'package'
  LIMIT 1;
  IF v_pm_label IS NULL THEN
    RAISE EXCEPTION 'Metode pembayaran "%" tidak valid.', p_payment_method;
  END IF;

  v_validity := COALESCE(v_pkg.validity_days, 30);

  INSERT INTO package_tracking (
    id, patient_id, package_type_id, package_name, total_sessions, sessions_used,
    sessions_remaining, start_date, end_date, validity_days, status, nominal,
    payment_method, is_lifecycle_package, clinic_id, purchase_payment_id
  ) VALUES (
    v_pkg_id, p_patient_id, v_pkg.id, v_pkg.label, v_pkg.session_count, 0,
    v_pkg.session_count, v_today, v_today + 365, v_validity, 'aktif', p_amount,
    v_pm_label, true, c_praxis, v_pay_id
  );

  -- Nomor kwitansi harian: KWT/YYYYMMDD/001 (dikunci supaya tidak bentrok).
  v_prefix := 'KWT/' || to_char(v_today, 'YYYYMMDD') || '/';
  PERFORM pg_advisory_xact_lock(hashtext('praxis_package_receipt_' || v_prefix));
  SELECT COUNT(*) + 1 INTO v_seq FROM package_payments
  WHERE clinic_id = c_praxis AND receipt_number LIKE v_prefix || '%';
  v_receipt := v_prefix || lpad(v_seq::text, 3, '0');

  IF v_role = 'admin' THEN
    v_cashier := auth.uid();
  END IF;

  INSERT INTO package_payments (
    id, clinic_id, patient_id, package_tracking_id, previous_package_id, package_name,
    total_sessions, amount, payment_method, bank_account_id, paid_at, receipt_number,
    cashier_id, created_by
  ) VALUES (
    v_pay_id, c_praxis, p_patient_id, v_pkg_id, v_prev_id, v_pkg.label,
    v_pkg.session_count, p_amount, v_pm_label, v_pm_bank, now(), v_receipt,
    v_cashier, auth.uid()
  );

  RETURN jsonb_build_object(
    'payment_id', v_pay_id,
    'package_tracking_id', v_pkg_id,
    'receipt_number', v_receipt,
    'amount', p_amount,
    'package_name', v_pkg.label
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.praxis_renew_package(uuid, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.praxis_renew_package(uuid, text, text, numeric) TO authenticated;

-- 3b. Mulai masa berlaku saat sesi pertama tertaut ------------------------------------------
CREATE OR REPLACE FUNCTION public.start_renewed_package_on_first_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE package_tracking
  SET start_date = NEW.recap_date,
      end_date = NEW.recap_date + COALESCE(validity_days, 30),
      first_used_at = NEW.recap_date,
      updated_at = now()
  WHERE id = NEW.package_tracking_id
    AND purchase_payment_id IS NOT NULL
    AND first_used_at IS NULL;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_start_renewed_package ON public.daily_recaps;
CREATE TRIGGER trg_start_renewed_package
  AFTER INSERT OR UPDATE OF package_tracking_id ON public.daily_recaps
  FOR EACH ROW
  WHEN (NEW.package_tracking_id IS NOT NULL AND NEW.recap_date IS NOT NULL)
  EXECUTE FUNCTION public.start_renewed_package_on_first_session();

-- 4. Batalkan pembayaran perpanjangan (owner, selama paket baru belum dipakai) -------------
CREATE OR REPLACE FUNCTION public.praxis_void_package_renewal(p_payment_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := get_my_role();
  v_clinic uuid := get_my_clinic_id();
  pay package_payments;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('owner', 'super_admin') THEN
    RAISE EXCEPTION 'Hanya owner yang dapat membatalkan pembayaran perpanjangan.' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Alasan pembatalan wajib diisi (minimal 5 karakter).';
  END IF;

  SELECT * INTO pay FROM package_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pembayaran tidak ditemukan.';
  END IF;
  IF v_role <> 'super_admin' AND pay.clinic_id IS DISTINCT FROM v_clinic THEN
    RAISE EXCEPTION 'Pembayaran bukan milik klinik Anda.' USING ERRCODE = '42501';
  END IF;
  IF pay.status = 'void' THEN
    RAISE EXCEPTION 'Pembayaran ini sudah dibatalkan.';
  END IF;

  IF pay.package_tracking_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM daily_recaps WHERE package_tracking_id = pay.package_tracking_id) THEN
      RAISE EXCEPTION 'Paket baru sudah dipakai pada kunjungan. Pembayaran tidak bisa dibatalkan.';
    END IF;
    DELETE FROM package_tracking WHERE id = pay.package_tracking_id;
  END IF;

  UPDATE package_payments
  SET status = 'void', void_reason = btrim(p_reason), voided_at = now(), voided_by = auth.uid()
  WHERE id = p_payment_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.praxis_void_package_renewal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.praxis_void_package_renewal(uuid, text) TO authenticated;
