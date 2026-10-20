-- TTV (tanda vital) menjadi bagian dari SOAP: bila TTV belum diisi, SOAP belum dianggap selesai
-- (soap_completed_at tetap NULL) sehingga pembayaran tetap terkunci dan insentif/deadline SOAP
-- tidak terhitung selesai. Dikendalikan per klinik lewat soap_first_settings.ttv_required.
--
-- Tidak menyentuh fungsi SOAP-first yang ada: trigger baru berjalan SETELAH ab_soap_first_prepare
-- (yang mengisi soap_completed_at) dan membatalkannya bila TTV belum ada.

-- 1. Sakelar per klinik (aktif untuk Kaffah) ---------------------------------------------------
ALTER TABLE public.soap_first_settings
  ADD COLUMN IF NOT EXISTS ttv_required boolean NOT NULL DEFAULT false;

UPDATE public.soap_first_settings
SET ttv_required = true
WHERE clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid;

-- 2. SOAP belum selesai selama TTV kosong ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_ad_soap_requires_ttv()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  -- Hanya menahan penyelesaian BARU (nilai berubah dari NULL / diisi ulang); recap yang sudah
  -- tercatat selesai dan tidak berubah dibiarkan.
  IF NEW.soap_completed_at IS NULL
     OR (TG_OP = 'UPDATE' AND NEW.soap_completed_at IS NOT DISTINCT FROM OLD.soap_completed_at) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
       SELECT 1 FROM soap_first_settings s
       WHERE s.clinic_id = NEW.clinic_id
         AND s.enabled AND s.ttv_required
         AND NEW.recap_date >= s.start_date
     )
     AND NOT EXISTS (SELECT 1 FROM recap_vital_signs rv WHERE rv.recap_id = NEW.id) THEN
    NEW.soap_completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.trg_ad_soap_requires_ttv() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ad_soap_requires_ttv ON public.daily_recaps;
CREATE TRIGGER ad_soap_requires_ttv
  BEFORE INSERT OR UPDATE ON public.daily_recaps
  FOR EACH ROW EXECUTE FUNCTION public.trg_ad_soap_requires_ttv();

-- 3. TTV diisi sesudah SOAP: nilai ulang recap agar SOAP tercatat selesai ----------------------
CREATE OR REPLACE FUNCTION public.trg_recap_vitals_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.recap_id IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE daily_recaps d
  SET updated_at = now()
  WHERE d.id = NEW.recap_id
    AND d.soap_completed_at IS NULL
    AND d.invoice_created_at IS NULL
    AND EXISTS (
      SELECT 1 FROM soap_first_settings s
      WHERE s.clinic_id = d.clinic_id AND s.enabled AND s.ttv_required AND d.recap_date >= s.start_date
    );
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.trg_recap_vitals_touch() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_recap_vitals_touch ON public.recap_vital_signs;
CREATE TRIGGER trg_recap_vitals_touch
  AFTER INSERT ON public.recap_vital_signs
  FOR EACH ROW EXECUTE FUNCTION public.trg_recap_vitals_touch();

-- 4. Recap yang sudah "SOAP selesai" tapi belum ber-TTV dan belum diinvoice dikembalikan ke belum selesai.
--    Yang sudah diinvoice tidak diubah (riwayat terkunci).
DO $$
BEGIN
  PERFORM set_config('app.soap_first_rpc', 'on', true);
  UPDATE public.daily_recaps d
  SET soap_completed_at = NULL, updated_at = now()
  WHERE d.soap_completed_at IS NOT NULL
    AND d.invoice_created_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.soap_first_settings s
      WHERE s.clinic_id = d.clinic_id AND s.enabled AND s.ttv_required AND d.recap_date >= s.start_date
    )
    AND NOT EXISTS (SELECT 1 FROM public.recap_vital_signs rv WHERE rv.recap_id = d.id);
END $$;
