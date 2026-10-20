-- KHUSUS Kaffah: TTV (tanda vital) wajib diisi sebelum invoice/pembayaran bisa disimpan.
-- Hanya soap_first_compute yang berubah (satu cabang baru); klinik lain tidak terpengaruh.
-- Invoice yang sudah terbit tidak terpengaruh (trigger keluar lebih dulu saat terkunci).
CREATE OR REPLACE FUNCTION public.soap_first_compute(
  d public.daily_recaps,
  p_prior_amount numeric,
  p_package_label text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  cfg record;
  v_is_hc boolean;
  v_hc_time text;
  v_label text;
  v_type_id uuid;
  v_hc boolean;
  v_followup boolean;
  v_soap_done boolean;
  v_unlock boolean;
  v_needs_soap boolean;
  v_pkg_label text;
  v_pkg_sessions integer;
  v_pkg_price numeric;
  v_is_purchase boolean := false;
  v_is_ru boolean := false;
  v_base numeric;
  v_surcharge numeric := 0;
  v_total numeric;
  v_err text;
  v_adjust numeric;
BEGIN
  SELECT * INTO cfg FROM soap_first_settings s WHERE s.clinic_id = d.clinic_id;
  IF NOT FOUND OR NOT cfg.enabled OR d.recap_date < cfg.start_date THEN
    RETURN jsonb_build_object('active', false);
  END IF;

  SELECT a.is_homecare, a.homecare_time_type INTO v_is_hc, v_hc_time
  FROM appointments a WHERE a.id = d.appointment_id;

  v_hc := COALESCE(v_is_hc, false);
  v_followup := d.package_tracking_id IS NOT NULL AND COALESCE(p_prior_amount, 0) = 0;
  v_soap_done := d.soap_completed_at IS NOT NULL;
  v_unlock := EXISTS (
    SELECT 1 FROM soap_overrides o
    WHERE o.recap_id = d.id AND o.kind = 'payment_unlock' AND o.status = 'approved'
  );
  v_needs_soap := (NOT v_hc) AND (NOT v_followup);

  v_label := soap_first_derive_label(d.clinic_id, d.special_type, v_hc, v_hc_time, d.xtratime, d.diagnosis);
  IF v_label IS NOT NULL THEN
    SELECT o.id INTO v_type_id FROM operational_options o
    WHERE o.clinic_id = d.clinic_id AND o.category = 'patient_type' AND o.label = v_label LIMIT 1;
  END IF;

  IF p_package_label IS NOT NULL AND lower(btrim(p_package_label)) NOT IN ('', 'reguler') THEN
    SELECT o.label, o.session_count, o.price INTO v_pkg_label, v_pkg_sessions, v_pkg_price
    FROM operational_options o
    WHERE o.clinic_id = d.clinic_id AND o.category = 'tipe_paket' AND lower(o.label) = lower(btrim(p_package_label))
    LIMIT 1;
    IF COALESCE(v_pkg_sessions, 0) > 1 AND d.package_tracking_id IS NULL THEN
      v_is_purchase := true;
      -- Paket RU: boleh untuk diagnosa apa pun, tanpa tambahan 2 keluhan.
      v_is_ru := v_pkg_label ILIKE '% RU';
    END IF;
  END IF;

  IF v_needs_soap AND NOT v_soap_done AND NOT v_unlock THEN
    v_err := 'SOAP belum diisi oleh terapis. Pembayaran terkunci sampai SOAP selesai.';
  ELSIF d.clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid
        AND NOT EXISTS (SELECT 1 FROM recap_vital_signs rv WHERE rv.recap_id = d.id) THEN
    v_err := 'TTV (tanda vital) belum diisi. Isi TTV di detail recap sebelum invoice dapat dikirim.';
  ELSIF d.special_type = 'free' THEN
    v_base := 0;
  ELSIF v_is_ru THEN
    IF v_pkg_price IS NULL THEN
      v_err := 'Harga paket "' || v_pkg_label || '" belum diatur owner.';
    ELSE
      v_base := v_pkg_price;
    END IF;
  ELSIF v_label IS NULL THEN
    IF v_hc THEN
      v_err := 'Pilih homecare di dalam atau di luar jam kerja pada appointment terlebih dahulu.';
    ELSE
      v_err := 'Tipe pasien belum dapat ditentukan karena diagnosa belum diisi terapis.';
    END IF;
  ELSIF v_is_purchase THEN
    IF v_label NOT IN ('NORMAL', 'DUA KELUHAN') THEN
      v_err := 'Paket hanya untuk pasien 1 atau 2 keluhan.';
    ELSIF v_pkg_price IS NULL THEN
      v_err := 'Harga paket "' || v_pkg_label || '" belum diatur owner.';
    ELSE
      v_base := v_pkg_price;
      IF v_label = 'DUA KELUHAN' THEN
        v_surcharge := cfg.two_complaint_package_surcharge * v_pkg_sessions;
      END IF;
    END IF;
  ELSE
    SELECT p.price INTO v_base FROM clinic_service_prices p
    WHERE p.clinic_id = d.clinic_id AND p.patient_type_id = v_type_id;
    IF v_base IS NULL THEN
      v_err := 'Harga untuk tipe "' || v_label || '" belum diatur owner.';
    END IF;
  END IF;

  -- Penyesuaian nominal yang sudah disetujui owner.
  SELECT NULLIF(o.payload ->> 'amount', '')::numeric INTO v_adjust
  FROM soap_overrides o
  WHERE o.recap_id = d.id AND o.kind = 'amount_adjust' AND o.status = 'approved'
  ORDER BY o.decided_at DESC NULLS LAST LIMIT 1;
  IF v_adjust IS NOT NULL AND v_err IS NULL THEN
    v_base := v_adjust;
    v_surcharge := 0;
  END IF;

  v_total := CASE WHEN v_base IS NULL THEN NULL ELSE v_base + v_surcharge END;

  RETURN jsonb_build_object(
    'active', true,
    'error', v_err,
    'soap_done', v_soap_done,
    'followup', v_followup,
    'homecare', v_hc,
    'needs_soap', v_needs_soap,
    'unlocked_by_override', v_unlock,
    'type_label', v_label,
    'type_id', v_type_id,
    'is_purchase', v_is_purchase,
    'package_sessions', v_pkg_sessions,
    'base', v_base,
    'surcharge', v_surcharge,
    'total', v_total,
    'package_allowed', (COALESCE(v_label IN ('NORMAL', 'DUA KELUHAN'), false) OR v_is_ru)
  );
END;
$fn$;
