-- ---------------------------------------------------------------------------
-- Cicilan paket (DP + pelunasan) khusus pasien yang diizinkan owner.
--
-- Alur:
--  1. Owner menandai pasien "boleh cicil paket" (patients.package_installment_allowed),
--     hanya lewat RPC set_patient_package_installment().
--  2. Pembelian paket (sesi pertama): admin mengisi DP (installment_dp_amount). Trigger
--     menyimpan harga penuh di package_installment_total, sedangkan amount = DP yang
--     benar-benar diterima hari itu. package_tracking.nominal tetap harga penuh.
--  3. Pelunasan: di edit recap sesi lanjutan paket yang sama, admin mencentang
--     "Pelunasan cicilan" (installment_payoff). Trigger mengisi amount = sisa tagihan,
--     metode & bukti bayar tercatat di recap itu, jadi uang masuk pada tanggal pelunasan
--     (revenue_date) dan semua laporan kas/QRIS/BSI membacanya seperti pembayaran biasa.
--
-- Paket lain / pasien lain tidak berubah: tanpa izin owner, DP ditolak server.
-- ---------------------------------------------------------------------------

-- 1. Kolom ---------------------------------------------------------------------
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS package_installment_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS package_installment_allowed_by uuid,
  ADD COLUMN IF NOT EXISTS package_installment_allowed_at timestamptz;

ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS package_installment_total numeric,
  ADD COLUMN IF NOT EXISTS installment_dp_amount numeric,
  ADD COLUMN IF NOT EXISTS installment_payoff boolean NOT NULL DEFAULT false;

-- 2. Izin cicilan per pasien: hanya owner, hanya lewat RPC ------------------------
CREATE OR REPLACE FUNCTION public.trg_patients_guard_package_installment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF COALESCE(current_setting('app.pkg_installment_rpc', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.package_installment_allowed := false;
    NEW.package_installment_allowed_by := NULL;
    NEW.package_installment_allowed_at := NULL;
  ELSE
    NEW.package_installment_allowed := OLD.package_installment_allowed;
    NEW.package_installment_allowed_by := OLD.package_installment_allowed_by;
    NEW.package_installment_allowed_at := OLD.package_installment_allowed_at;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_patients_guard_package_installment ON public.patients;
CREATE TRIGGER trg_patients_guard_package_installment
  BEFORE INSERT OR UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.trg_patients_guard_package_installment();

CREATE OR REPLACE FUNCTION public.set_patient_package_installment(p_patient_id uuid, p_allowed boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_role text := get_my_role();
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('owner', 'super_admin') THEN
    RAISE EXCEPTION 'Hanya owner yang dapat mengatur izin cicilan paket.';
  END IF;
  PERFORM set_config('app.pkg_installment_rpc', 'on', true);
  UPDATE patients
  SET package_installment_allowed = COALESCE(p_allowed, false),
      package_installment_allowed_by = CASE WHEN COALESCE(p_allowed, false) THEN auth.uid() ELSE NULL END,
      package_installment_allowed_at = CASE WHEN COALESCE(p_allowed, false) THEN now() ELSE NULL END
  WHERE id = p_patient_id AND clinic_id = get_my_clinic_id();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pasien tidak ditemukan.';
  END IF;
  PERFORM set_config('app.pkg_installment_rpc', 'off', true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.set_patient_package_installment(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_patient_package_installment(uuid, boolean) TO authenticated;

-- 3. Saldo cicilan satu paket -------------------------------------------------------
-- total = harga penuh paket; paid = DP + semua pelunasan yang sudah terbit invoice.
-- p_exclude: recap yang sedang dihitung (agar tidak menghitung dirinya sendiri).
CREATE OR REPLACE FUNCTION public.package_installment_balance(p_tracking uuid, p_exclude uuid DEFAULT NULL)
RETURNS TABLE (purchase_recap_id uuid, total numeric, paid numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id,
         p.package_installment_total,
         COALESCE(p.amount, 0) + COALESCE((
           SELECT SUM(COALESCE(x.amount, 0))
           FROM daily_recaps x
           WHERE x.package_tracking_id = p_tracking
             AND x.installment_payoff
             AND x.invoice_created_at IS NOT NULL
             AND x.id IS DISTINCT FROM p_exclude
         ), 0)
  FROM daily_recaps p
  WHERE p.package_tracking_id = p_tracking
    AND p.package_installment_total IS NOT NULL
    AND p.id IS DISTINCT FROM p_exclude
  ORDER BY p.recap_date, p.created_at
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.package_installment_balance(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Status untuk modal edit recap.
-- kind: 'purchase' (recap pembelian bercicilan), 'payoff' (recap pelunasan),
--       'followup' (sesi paket biasa dari paket bercicilan), 'none'.
CREATE OR REPLACE FUNCTION public.package_installment_status(p_recap_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  d public.daily_recaps;
  v_allowed boolean := false;
  v_kind text := 'none';
  v_total numeric;
  v_paid numeric;
  b record;
BEGIN
  SELECT * INTO d FROM daily_recaps WHERE id = p_recap_id;
  IF NOT FOUND OR d.clinic_id IS DISTINCT FROM get_my_clinic_id() THEN
    RETURN jsonb_build_object('kind', 'none', 'allowed', false);
  END IF;

  SELECT COALESCE(p.package_installment_allowed, false) INTO v_allowed
  FROM patients p WHERE p.id = d.patient_id;
  v_allowed := COALESCE(v_allowed, false);

  IF d.package_installment_total IS NOT NULL THEN
    v_kind := 'purchase';
    SELECT * INTO b FROM package_installment_balance(d.package_tracking_id, NULL);
    v_total := COALESCE(b.total, d.package_installment_total);
    v_paid := COALESCE(b.paid, COALESCE(d.amount, 0));
  ELSIF d.package_tracking_id IS NOT NULL THEN
    SELECT * INTO b FROM package_installment_balance(d.package_tracking_id, d.id);
    IF b.total IS NOT NULL THEN
      v_kind := CASE WHEN d.installment_payoff THEN 'payoff' ELSE 'followup' END;
      v_total := b.total;
      v_paid := b.paid;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'kind', v_kind,
    'total', v_total,
    -- purchase: sudah dibayar (DP + pelunasan); followup/payoff: sudah dibayar SEBELUM recap ini.
    'paid', v_paid,
    'remaining', CASE WHEN v_total IS NULL THEN NULL ELSE GREATEST(v_total - v_paid, 0) END,
    'can_pay_off', (v_kind = 'followup' AND d.invoice_created_at IS NULL AND v_total - v_paid > 0
                    AND COALESCE(d.special_type, '') <> 'free'),
    'payoff_amount', CASE WHEN v_kind = 'payoff' THEN d.amount ELSE NULL END
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.package_installment_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.package_installment_status(uuid) TO authenticated;

-- 4. Trigger utama (setelah ab_soap_first_prepare, sebelum apply_discount & bz_soap_first_final) ---
CREATE OR REPLACE FUNCTION public.trg_ae_package_installment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_first boolean;
  v_allowed boolean;
  v_calc jsonb;
  v_total numeric;
  v_remaining numeric;
  b record;
BEGIN
  v_first := TG_OP = 'INSERT' OR OLD.invoice_created_at IS NULL;

  -- Pelunasan: recap sesi lanjutan paket bercicilan yang belum ber-invoice.
  IF COALESCE(NEW.installment_payoff, false) AND v_first THEN
    IF NEW.package_tracking_id IS NULL THEN
      RAISE EXCEPTION 'Pelunasan cicilan hanya untuk sesi yang tertaut ke paket.';
    END IF;
    IF NULLIF(btrim(COALESCE(NEW.payment_method, '')), '') IS NULL OR NEW.payment_method = 'Package' THEN
      RAISE EXCEPTION 'Pilih metode pembayaran untuk pelunasan cicilan.';
    END IF;
    IF NEW.special_type = 'free' THEN
      RAISE EXCEPTION 'Sesi Free tidak dapat dipakai untuk pelunasan cicilan.';
    END IF;
    SELECT * INTO b FROM package_installment_balance(NEW.package_tracking_id, NEW.id);
    IF b.total IS NULL THEN
      RAISE EXCEPTION 'Paket ini bukan paket cicilan.';
    END IF;
    v_remaining := b.total - b.paid;
    IF v_remaining <= 0 THEN
      RAISE EXCEPTION 'Cicilan paket ini sudah lunas.';
    END IF;
    NEW.amount_original := v_remaining;
    NEW.amount := v_remaining;
    NEW.discount_type := NULL;
    NEW.discount_value := 0;
    NEW.discount_label := NULL;
    NEW.installment_dp_amount := NULL;
    NEW.package_installment_total := NULL;
    NEW.invoice_created_at := COALESCE(NEW.invoice_created_at, now());
    RETURN NEW;
  END IF;

  -- DP pembelian paket: dijalankan saat invoice pembelian baru terbit (ab_soap_first_prepare
  -- sudah memvalidasi SOAP, paket & harga).
  IF NEW.installment_dp_amount IS NOT NULL AND NEW.invoice_created_at IS NOT NULL AND v_first
     AND NEW.package_installment_total IS NULL THEN
    SELECT COALESCE(p.package_installment_allowed, false) INTO v_allowed
    FROM patients p WHERE p.id = NEW.patient_id;
    IF NOT COALESCE(v_allowed, false) THEN
      RAISE EXCEPTION 'Pasien ini belum diizinkan owner untuk membayar paket dengan cicilan.';
    END IF;
    v_calc := soap_first_compute(NEW, 0, NEW.package_type);
    IF v_calc ->> 'error' IS NOT NULL THEN
      RAISE EXCEPTION '%', v_calc ->> 'error';
    END IF;
    IF NOT COALESCE((v_calc ->> 'is_purchase')::boolean, false) THEN
      RAISE EXCEPTION 'Cicilan hanya untuk pembelian paket (sesi pertama).';
    END IF;
    v_total := (v_calc ->> 'total')::numeric;
    IF NEW.installment_dp_amount <= 0 OR NEW.installment_dp_amount >= v_total THEN
      RAISE EXCEPTION 'Nominal DP harus lebih dari 0 dan kurang dari harga paket (Rp %).', v_total;
    END IF;
    NEW.package_installment_total := v_total;
    NEW.amount_original := NEW.installment_dp_amount;
    NEW.amount := NEW.installment_dp_amount;
    RETURN NEW;
  END IF;

  -- Selain jalur di atas, kolom cicilan tidak boleh berubah lewat update biasa.
  IF TG_OP = 'UPDATE' THEN
    NEW.package_installment_total := OLD.package_installment_total;
    NEW.installment_dp_amount := OLD.installment_dp_amount;
    NEW.installment_payoff := OLD.installment_payoff;
  ELSE
    NEW.package_installment_total := NULL;
    NEW.installment_dp_amount := NULL;
    NEW.installment_payoff := false;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS ae_package_installment ON public.daily_recaps;
CREATE TRIGGER ae_package_installment
  BEFORE INSERT OR UPDATE ON public.daily_recaps
  FOR EACH ROW EXECUTE FUNCTION public.trg_ae_package_installment();

-- 5. ab_soap_first_prepare: pelunasan tidak dihitung ulang dari daftar harga ----------
-- (nominalnya diisi ae_package_installment). Diubah lewat penggantian teks pada definisi
-- yang sedang berlaku agar tidak menyalin ulang fungsi sepanjang itu.
DO $do$
DECLARE
  v_def text;
  v_marker constant text := 'v_is_payment := (NEW.payment_method IS NOT NULL AND NEW.payment_method <> ''Package'') OR NEW.special_type = ''free'';';
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public.trg_ab_soap_first_prepare()'::regprocedure);
  IF position('installment_payoff' IN v_def) > 0 THEN
    RETURN; -- sudah diterapkan
  END IF;
  IF (length(v_def) - length(replace(v_def, v_marker, ''))) / length(v_marker) <> 1 THEN
    RAISE EXCEPTION 'trg_ab_soap_first_prepare berubah: penanda tidak ditemukan tepat satu kali.';
  END IF;
  v_new := replace(v_def, v_marker,
    '-- Pelunasan cicilan paket: nominal & invoice diurus ae_package_installment.' || chr(10) ||
    '  IF COALESCE(NEW.installment_payoff, false) THEN RETURN NEW; END IF;' || chr(10) ||
    '  ' || v_marker);
  EXECUTE v_new;
END;
$do$;

-- 6. Sesi paket Rp 0 tidak boleh diubah nominalnya, kecuali pelunasan cicilan ------------
CREATE OR REPLACE FUNCTION public.block_amount_edit_on_package_session()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.package_tracking_id IS NOT NULL
       AND COALESCE(OLD.amount_original, OLD.amount, 0) = 0
       AND COALESCE(NEW.amount_original, NEW.amount, 0) <> 0
       AND NOT COALESCE(NEW.installment_payoff, false)
    THEN
        RAISE EXCEPTION 'Sesi ini adalah bagian dari kuota paket (nominal Rp 0) dan tidak bisa diubah nominalnya selama masih tertaut ke paket.';
    END IF;

    RETURN NEW;
END;
$function$;

-- 7. Pembuatan paket: nominal paket = harga penuh (bukan DP); pelunasan tidak membuat paket -----
CREATE OR REPLACE FUNCTION public.create_package_on_recap_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_session_count INT;
    v_package_label TEXT;
    v_validity_days INT;
    v_package_id UUID;
    v_existing_package UUID;
    v_package_type_id UUID;
    v_old_status TEXT;
BEGIN
IF
    NEW.package_type IS NOT DISTINCT FROM OLD.package_type
    AND NEW.amount IS NOT DISTINCT FROM OLD.amount
THEN
    RETURN NEW;
END IF;

    -- hanya jalan saat update
    IF TG_OP <> 'UPDATE' THEN
        RETURN NEW;
    END IF;

    -- hanya jika amount > 0
    IF COALESCE(NEW.amount,0) <= 0 THEN
        RETURN NEW;
    END IF;

    -- pelunasan cicilan: sesi lanjutan paket, bukan pembelian paket baru
    IF COALESCE(NEW.installment_payoff, false) THEN
        RETURN NEW;
    END IF;

    -- CEK PACKAGE LAMA (PENTING BANGET)
    -- Kalau recap ini sudah tertaut ke paket yang MASIH VALID (aktif/diperpanjang),
    -- edit nominal/jenis paket TIDAK BOLEH bikin paket baru — cukup pertahankan link-nya.
    -- Ini yang tadinya bikin paket kepecah/duplikat waktu recap pembelian diedit.
    IF NEW.package_tracking_id IS NOT NULL THEN
        SELECT status INTO v_old_status
        FROM package_tracking
        WHERE id = NEW.package_tracking_id;

        IF v_old_status IN ('aktif','diperpanjang') THEN
            RETURN NEW;
        END IF;

        -- paket lama sudah tidak valid (selesai/expired/dihapus) -> lepas link, lanjut proses paket baru
        NEW.package_tracking_id := NULL;
        NEW.urutan_session := NULL;
    END IF;

    -- ambil info paket baru
    SELECT id, label, session_count, validity_days
    INTO v_package_type_id, v_package_label, v_session_count, v_validity_days
    FROM operational_options
    WHERE LOWER(label) = LOWER(NEW.package_type)
    AND category = 'tipe_paket'
    LIMIT 1;

    -- kalau paket tidak ditemukan
    IF v_package_type_id IS NULL THEN
        RAISE EXCEPTION 'Jenis paket tidak ditemukan di sistem.';
    END IF;

    -- bukan paket (misal sesi tunggal)
    IF COALESCE(v_session_count,0) <= 1 THEN
        RETURN NEW;
    END IF;

    -- cek apakah masih ada paket aktif lain (termasuk yang sedang diperpanjang)
    SELECT id INTO v_existing_package
    FROM package_tracking
    WHERE patient_id = NEW.patient_id
    AND status IN ('aktif','pending','diperpanjang')
    LIMIT 1;

    IF v_existing_package IS NOT NULL THEN
        RAISE EXCEPTION
        'Pasien masih memiliki paket aktif / pending.';
    END IF;

    -- buat package baru
    INSERT INTO package_tracking (
        patient_id,
        package_type_id,
        package_name,
        total_sessions,
        sessions_used,
        sessions_remaining,
        start_date,
        end_date,
        validity_days,
        nominal,
        status,
        created_at,
        updated_at,
        first_used_at
    )
    VALUES (
        NEW.patient_id,
        v_package_type_id,
        v_package_label,
        v_session_count,
        0, -- biarkan 0 (nanti dihitung AFTER trigger)
        v_session_count,
        NEW.recap_date,
        NEW.recap_date + (v_validity_days || ' days')::interval,
        v_validity_days,
        COALESCE(NEW.package_installment_total, NEW.amount), -- cicilan: harga penuh, bukan DP
        'aktif',
        now(),
        now(),
        NULL
    )
    RETURNING id INTO v_package_id;

    -- assign ke recap
    NEW.package_tracking_id := v_package_id;

    NEW.amount_original := COALESCE(NEW.amount_original, OLD.amount_original);

    RETURN NEW;

END;
$function$;
