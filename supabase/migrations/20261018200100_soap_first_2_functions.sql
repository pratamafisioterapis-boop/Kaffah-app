-- SOAP-first (KHUSUS Kaffah) - tahap 2: fungsi bantu, penghitung harga, status insentif.
-- Tanpa DROP. Semua fungsi mengembalikan hasil "tidak aktif" bila klinik belum mengaktifkan fitur.

-- Diagnosa di daily_recaps bisa berupa array, string JSON, atau string tunggal.
CREATE OR REPLACE FUNCTION public.soap_first_diag_ids(p_diag jsonb)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  v jsonb := p_diag;
  v_txt text;
BEGIN
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
    RETURN '{}'::text[];
  END IF;
  IF jsonb_typeof(v) = 'string' THEN
    v_txt := btrim(v #>> '{}');
    IF v_txt = '' THEN
      RETURN '{}'::text[];
    END IF;
    BEGIN
      v := v_txt::jsonb;
    EXCEPTION WHEN others THEN
      RETURN ARRAY[v_txt];
    END;
  END IF;
  IF jsonb_typeof(v) = 'array' THEN
    RETURN COALESCE((SELECT array_agg(btrim(e)) FROM jsonb_array_elements_text(v) AS e WHERE btrim(e) <> ''), '{}'::text[]);
  END IF;
  RETURN ARRAY[btrim(v #>> '{}')];
END;
$fn$;

-- Tentukan label tipe pasien dari SOAP + appointment.
-- Prioritas: Free > Konsultasi (pilihan admin) > Homecare > Xtratime > DOMS > jumlah diagnosa.
CREATE OR REPLACE FUNCTION public.soap_first_derive_label(
  p_clinic uuid,
  p_special text,
  p_is_homecare boolean,
  p_hc_time text,
  p_xtratime boolean,
  p_diag jsonb
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_ids text[];
  v_total integer;
  v_doms integer;
BEGIN
  IF p_special = 'free' THEN
    RETURN 'FREE';
  END IF;
  IF p_special = 'konsultasi' THEN
    RETURN 'KONSULTASI';
  END IF;
  IF COALESCE(p_is_homecare, false) THEN
    IF p_hc_time = 'dalam' THEN
      RETURN 'HOMECARE (dlm jam kerja)';
    ELSIF p_hc_time = 'luar' THEN
      RETURN 'HOMECARE (luar jam kerja)';
    END IF;
    RETURN NULL;
  END IF;

  v_ids := soap_first_diag_ids(p_diag);
  v_total := COALESCE(array_length(v_ids, 1), 0);
  IF v_total = 0 THEN
    RETURN NULL;
  END IF;

  IF COALESCE(p_xtratime, false) THEN
    IF v_total >= 2 THEN
      RETURN 'XTRATIME+DUA KELUHAN';
    END IF;
    RETURN 'XTRATIME';
  END IF;

  SELECT count(*) INTO v_doms
  FROM operational_options o
  WHERE o.category = 'diagnosa'
    AND o.clinic_id = p_clinic
    AND o.id::text = ANY (v_ids)
    AND o.label ILIKE 'doms%';

  IF v_doms > 0 THEN
    IF v_total >= 2 THEN
      RETURN 'RECOVERY+TREATMENT';
    END IF;
    RETURN 'RECOVERY';
  END IF;

  IF v_total >= 2 THEN
    RETURN 'DUA KELUHAN';
  END IF;
  RETURN 'NORMAL';
END;
$fn$;

-- Penghitung tunggal: dipakai trigger dan RPC penawaran (quote) agar hasilnya selalu sama.
-- p_prior_amount = nominal recap SEBELUM perubahan (untuk mengenali sesi lanjutan paket).
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
    END IF;
  END IF;

  IF v_needs_soap AND NOT v_soap_done AND NOT v_unlock THEN
    v_err := 'SOAP belum diisi oleh terapis. Pembayaran terkunci sampai SOAP selesai.';
  ELSIF d.special_type = 'free' THEN
    v_base := 0;
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
    'package_allowed', (v_label IN ('NORMAL', 'DUA KELUHAN'))
  );
END;
$fn$;

-- Penawaran untuk tampilan admin: nominal, status kunci, tipe pasien.
CREATE OR REPLACE FUNCTION public.soap_first_quote(p_recap_id uuid, p_package_label text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  d public.daily_recaps;
  v jsonb;
BEGIN
  SELECT * INTO d FROM daily_recaps WHERE id = p_recap_id;
  IF NOT FOUND OR d.clinic_id IS DISTINCT FROM get_my_clinic_id() THEN
    RETURN jsonb_build_object('active', false);
  END IF;
  v := soap_first_compute(d, d.amount_original, p_package_label);
  RETURN v || jsonb_build_object(
    'invoice_locked', (d.invoice_created_at IS NOT NULL),
    'special_type', d.special_type,
    'xtratime', d.xtratime
  );
END;
$fn$;

-- Status insentif per recap: insentif jadi nol bila SOAP terlambat / tidak diisi.
-- Non-paket & bukan homecare: batas = akhir slot + incentive_grace_minutes.
-- Sesi lanjutan paket & homecare: batas = 23:59 WITA pada hari recap.
CREATE OR REPLACE FUNCTION public.get_recap_incentive_flags(p_recap_ids uuid[])
RETURNS TABLE (recap_id uuid, zeroed boolean, reason text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  WITH base AS (
    SELECT
      d.id,
      d.recap_date,
      d.soap_completed_at,
      d.incentive_zero_manual,
      s.enabled AND d.recap_date >= s.start_date AS active,
      (d.package_tracking_id IS NOT NULL AND COALESCE(d.amount_original, d.amount, 0) = 0) AS followup,
      COALESCE(a.is_homecare, false) AS homecare,
      a.appointment_date,
      a.duration_minutes,
      s.incentive_grace_minutes,
      EXISTS (
        SELECT 1 FROM soap_overrides o
        WHERE o.recap_id = d.id AND o.kind = 'incentive_restore' AND o.status = 'approved'
      ) AS restored
    FROM daily_recaps d
    LEFT JOIN soap_first_settings s ON s.clinic_id = d.clinic_id
    LEFT JOIN appointments a ON a.id = d.appointment_id
    WHERE d.id = ANY (p_recap_ids)
      AND d.clinic_id = get_my_clinic_id()
  ),
  dl AS (
    SELECT b.*,
      CASE
        WHEN b.followup OR b.homecare OR b.appointment_date IS NULL
          THEN ((b.recap_date + 1)::timestamp AT TIME ZONE 'Asia/Makassar')
        ELSE b.appointment_date + make_interval(mins => COALESCE(b.duration_minutes, 0) + COALESCE(b.incentive_grace_minutes, 20))
      END AS deadline
    FROM base b
  )
  SELECT
    dl.id,
    CASE
      WHEN NOT COALESCE(dl.active, false) THEN false
      WHEN dl.restored THEN false
      WHEN dl.incentive_zero_manual THEN true
      WHEN dl.soap_completed_at IS NULL THEN now() > dl.deadline
      ELSE dl.soap_completed_at > dl.deadline
    END,
    CASE
      WHEN NOT COALESCE(dl.active, false) THEN NULL
      WHEN dl.restored THEN NULL
      WHEN dl.incentive_zero_manual THEN 'ditandai_owner'
      WHEN dl.soap_completed_at IS NULL AND now() > dl.deadline THEN 'soap_tidak_diisi'
      WHEN dl.soap_completed_at IS NOT NULL AND dl.soap_completed_at > dl.deadline THEN 'soap_terlambat'
      ELSE NULL
    END
  FROM dl;
$fn$;

REVOKE ALL ON FUNCTION public.soap_first_quote(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soap_first_quote(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_recap_incentive_flags(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recap_incentive_flags(uuid[]) TO authenticated;
REVOKE ALL ON FUNCTION public.soap_first_compute(public.daily_recaps, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.soap_first_derive_label(uuid, text, boolean, text, boolean, jsonb) FROM PUBLIC, anon, authenticated;
