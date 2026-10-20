-- Kaffah: sesi lanjutan paket tidak boleh memakai 2 diagnosa bila paket dibeli sebagai 1 keluhan (NORMAL).
-- Tanpa ini, terapis bisa menambah diagnosa ke-2 di sesi lanjutan sehingga tipe pasien otomatis
-- menjadi DUA KELUHAN padahal tambahan 2 keluhan (per sesi x jumlah sesi) tidak pernah dibayar.
-- Tingkat keluhan paket = tipe pasien pada recap pembelian (recap paket pertama yang bernominal > 0).
-- Paket RU dikecualikan (boleh diagnosa apa pun). Hanya berlaku bila SOAP-first aktif dan
-- hanya saat diagnosa berubah, sehingga data lama & update biasa tidak terblokir.
CREATE OR REPLACE FUNCTION public.trg_ad_package_single_complaint_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  cfg record;
  v_ids text[];
  v_old_ids text[];
  v_pkg_name text;
  v_buy_type text;
BEGIN
  IF NEW.package_tracking_id IS NULL OR NEW.recap_date IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.* INTO cfg FROM soap_first_settings s WHERE s.clinic_id = NEW.clinic_id;
  IF NOT FOUND OR NOT cfg.enabled OR NEW.recap_date < cfg.start_date THEN
    RETURN NEW;
  END IF;

  v_ids := soap_first_diag_ids(NEW.diagnosis);
  IF COALESCE(array_length(v_ids, 1), 0) < 2 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old_ids := soap_first_diag_ids(OLD.diagnosis);
    IF v_ids IS NOT DISTINCT FROM v_old_ids AND NEW.package_tracking_id IS NOT DISTINCT FROM OLD.package_tracking_id THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT pt.package_name INTO v_pkg_name FROM package_tracking pt WHERE pt.id = NEW.package_tracking_id;
  IF v_pkg_name ILIKE '% RU' THEN
    RETURN NEW;
  END IF;

  -- Recap pembelian paket (bukan recap ini sendiri).
  SELECT d.patient_type INTO v_buy_type
  FROM daily_recaps d
  WHERE d.package_tracking_id = NEW.package_tracking_id
    AND d.id IS DISTINCT FROM NEW.id
    AND COALESCE(d.amount_original, d.amount, 0) > 0
  ORDER BY d.recap_date, d.created_at
  LIMIT 1;

  IF v_buy_type = 'NORMAL' THEN
    RAISE EXCEPTION 'Paket ini dibeli untuk 1 keluhan. Sesi paket hanya boleh 1 diagnosa. Untuk 2 keluhan, pasien perlu membayar tambahan paket 2 keluhan (hubungi admin/owner).';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS ad_package_single_complaint_guard ON public.daily_recaps;
CREATE TRIGGER ad_package_single_complaint_guard
  BEFORE INSERT OR UPDATE ON public.daily_recaps
  FOR EACH ROW EXECUTE FUNCTION public.trg_ad_package_single_complaint_guard();

REVOKE ALL ON FUNCTION public.trg_ad_package_single_complaint_guard() FROM PUBLIC, anon, authenticated;

-- Dipakai form SOAP terapis untuk membatasi pilihan diagnosa sebelum menyimpan.
CREATE OR REPLACE FUNCTION public.package_max_diagnoses(p_recap_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  d public.daily_recaps;
  v_pkg_name text;
  v_buy_type text;
BEGIN
  SELECT * INTO d FROM daily_recaps WHERE id = p_recap_id;
  IF NOT FOUND OR d.clinic_id IS DISTINCT FROM get_my_clinic_id() OR d.package_tracking_id IS NULL THEN
    RETURN 2;
  END IF;
  SELECT pt.package_name INTO v_pkg_name FROM package_tracking pt WHERE pt.id = d.package_tracking_id;
  IF v_pkg_name ILIKE '% RU' THEN
    RETURN 2;
  END IF;
  SELECT x.patient_type INTO v_buy_type
  FROM daily_recaps x
  WHERE x.package_tracking_id = d.package_tracking_id
    AND x.id IS DISTINCT FROM d.id
    AND COALESCE(x.amount_original, x.amount, 0) > 0
  ORDER BY x.recap_date, x.created_at
  LIMIT 1;
  RETURN CASE WHEN v_buy_type = 'NORMAL' THEN 1 ELSE 2 END;
END;
$fn$;

REVOKE ALL ON FUNCTION public.package_max_diagnoses(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.package_max_diagnoses(uuid) TO authenticated;
