-- Perpanjangan paket Praxis: bayar di muka pada appointment berikutnya.
--
-- Masalah: pasien Praxis membayar paket baru pada hari sesi terakhir paket lama. Invoice
-- harus terbit saat pembayaran, tetapi sesi paket baru baru boleh terhitung pada hari terapi.
-- Jalur lama (AddPackageModal -> package_tracking 'pending') tidak membuat recap, jadi tidak
-- ada invoice; jalur beli lewat rekap langsung memakai sesi 1 pada hari bayar.
--
-- Solusi: pakai mekanisme bayar di muka yang sudah ada (recap berbayar dibuat lebih awal pada
-- appointment mendatang, recap_date = tanggal terapi; recalculate_package_sessions hanya
-- menghitung recap yang recap_date-nya sudah tiba). prepay_package() asli (Kaffah) TIDAK
-- diubah; fungsi baru ini khusus Praxis dan berbeda dalam tiga hal:
--   1. semua paket multi-sesi non-homecare boleh (bukan hanya paket "RU"/homecare);
--   2. nominal diisi admin (harga paket Praxis di operational_options masih kosong);
--   3. invoice_created_at diisi di sini (Praxis tidak memakai SOAP-first yang biasanya
--      mengisinya), sehingga revenue_date = hari bayar, bukan hari terapi.
-- Refund memakai refund_prepaid_package() yang sudah ada.

CREATE OR REPLACE FUNCTION public.praxis_prepay_package(
  p_appointment_id uuid,
  p_package_label text,
  p_payment_method text,
  p_amount numeric DEFAULT NULL
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
  a appointments;
  v_today date := (now() AT TIME ZONE 'Asia/Makassar')::date;
  v_appt_date date;
  v_pkg operational_options;
  v_amount numeric;
  v_pm_label text;
  v_pm_bank uuid;
  v_therapist_name text;
  v_recap_id uuid := gen_random_uuid();
  r daily_recaps;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin', 'clinic_admin', 'owner', 'super_admin') THEN
    RAISE EXCEPTION 'Anda tidak punya izin untuk mencatat pembayaran di muka.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO a FROM appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment tidak ditemukan.';
  END IF;
  IF a.clinic_id IS DISTINCT FROM c_praxis THEN
    RAISE EXCEPTION 'Fitur ini khusus klinik Praxis.' USING ERRCODE = '42501';
  END IF;
  IF v_role <> 'super_admin' AND a.clinic_id IS DISTINCT FROM v_clinic THEN
    RAISE EXCEPTION 'Appointment bukan milik klinik Anda.' USING ERRCODE = '42501';
  END IF;

  IF a.status NOT IN ('confirmed', 'rescheduled') THEN
    RAISE EXCEPTION 'Appointment harus berstatus terkonfirmasi.';
  END IF;
  IF a.patient_id IS NULL THEN
    RAISE EXCEPTION 'Paket hanya untuk pasien terdaftar (bukan tamu).';
  END IF;

  v_appt_date := (a.appointment_date AT TIME ZONE 'Asia/Makassar')::date;
  IF v_appt_date <= v_today THEN
    RAISE EXCEPTION 'Appointment ini hari ini atau sudah lewat. Buat appointment berikutnya (tanggal mendatang) lalu catat pembayaran paket di sana.';
  END IF;

  IF EXISTS (SELECT 1 FROM daily_recaps WHERE appointment_id = a.id) THEN
    RAISE EXCEPTION 'Appointment ini sudah memiliki recap.';
  END IF;

  SELECT * INTO v_pkg FROM operational_options o
  WHERE o.clinic_id = a.clinic_id AND o.category = 'tipe_paket'
    AND COALESCE(o.is_active, true)
    AND lower(o.label) = lower(btrim(p_package_label))
  LIMIT 1;
  IF NOT FOUND OR COALESCE(v_pkg.session_count, 0) <= 1 THEN
    RAISE EXCEPTION 'Paket "%" tidak ditemukan.', p_package_label;
  END IF;
  IF COALESCE(v_pkg.is_homecare, false) AND NOT COALESCE(a.is_homecare, false) THEN
    RAISE EXCEPTION 'Paket homecare hanya untuk appointment homecare.';
  END IF;

  v_amount := COALESCE(p_amount, v_pkg.price);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal paket "%" wajib diisi (lebih dari 0).', v_pkg.label;
  END IF;

  -- Paket lama harus sudah selesai/expired. Sesi terakhir paket lama dicatat dulu lewat
  -- rekap harian seperti biasa; setelah itu paket lama berstatus selesai.
  IF EXISTS (
    SELECT 1 FROM package_tracking pt
    WHERE pt.patient_id = a.patient_id AND pt.status IN ('aktif', 'pending', 'diperpanjang')
  ) THEN
    RAISE EXCEPTION 'Pasien masih memiliki paket aktif / pending. Simpan dulu sesi terakhir paket lama di rekap harian.';
  END IF;

  SELECT o.label, o.bank_account_id INTO v_pm_label, v_pm_bank
  FROM operational_options o
  WHERE o.clinic_id = a.clinic_id AND o.category = 'payment_method'
    AND COALESCE(o.is_active, true)
    AND lower(o.label) = lower(btrim(p_payment_method))
    AND lower(o.label) <> 'package'
  LIMIT 1;
  IF v_pm_label IS NULL THEN
    RAISE EXCEPTION 'Metode pembayaran "%" tidak valid.', p_payment_method;
  END IF;

  SELECT name INTO v_therapist_name FROM physiotherapists WHERE id = a.therapist_id;

  -- Recap lebih awal (sama seperti recap hari-H), lalu isi pembayaran lewat UPDATE supaya
  -- trigger paket (create_package_on_recap_update) membuat package_tracking 'aktif'.
  INSERT INTO daily_recaps (
    id, appointment_id, patient_id, therapist_id, therapist_name, patient_type,
    recap_date, created_at, updated_at, status, guest_name, guest_phone, clinic_id
  ) VALUES (
    v_recap_id, a.id, a.patient_id, a.therapist_id, v_therapist_name, 'registered',
    v_appt_date, now(), now(), a.status, a.guest_name, a.guest_phone, a.clinic_id
  );

  UPDATE daily_recaps
  SET package_type = v_pkg.label,
      payment_method = v_pm_label,
      bank_account_id = v_pm_bank,
      amount = v_amount,
      amount_original = v_amount,
      prepaid_at = now(),
      invoice_created_at = now(),
      updated_at = now()
  WHERE id = v_recap_id
  RETURNING * INTO r;

  IF r.package_tracking_id IS NULL THEN
    RAISE EXCEPTION 'Pembayaran di muka gagal dicatat (paket tidak terbentuk).';
  END IF;

  UPDATE package_tracking SET clinic_id = a.clinic_id
  WHERE id = r.package_tracking_id AND clinic_id IS NULL;

  RETURN jsonb_build_object(
    'recap_id', r.id,
    'package_tracking_id', r.package_tracking_id,
    'amount', r.amount,
    'payment_method', r.payment_method,
    'receipt_number', r.receipt_number,
    'paid_at', r.invoice_created_at,
    'therapy_date', r.recap_date
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.praxis_prepay_package(uuid, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.praxis_prepay_package(uuid, text, text, numeric) TO authenticated;
