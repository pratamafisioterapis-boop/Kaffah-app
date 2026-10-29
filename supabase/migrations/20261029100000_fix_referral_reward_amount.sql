-- Perbaikan: recap yang memakai referral reward tetap tercatat nominal penuh (mis. Rp 200.000)
-- walau diskon sudah benar. trg_ab_soap_first_prepare menyetel amount = amount_original, lalu
-- trg_zz_soap_first_final langsung keluar untuk referral_reward_id (mengandalkan apply_discount_to_amount),
-- padahal trigger lama itu tidak jalan bila UPDATE tidak menyentuh kolom amount/discount_type/discount_value.
-- Sekarang nominal referral dihitung di sini juga (pembulatan rupiah, sama seperti apply_discount_to_amount).

CREATE OR REPLACE FUNCTION public.trg_zz_soap_first_final()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cfg record;
BEGIN
  IF NEW.invoice_created_at IS NULL OR NEW.amount_original IS NULL OR NOT NEW.soap_first_applied THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.invoice_created_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT s.* INTO cfg FROM soap_first_settings s WHERE s.clinic_id = NEW.clinic_id;
  IF NOT FOUND OR NOT cfg.enabled OR NEW.recap_date < cfg.start_date THEN
    RETURN NEW;
  END IF;
  IF NEW.special_type = 'free' THEN
    NEW.amount := 0;
    RETURN NEW;
  END IF;

  IF NEW.discount_type IS NULL OR COALESCE(NEW.discount_value, 0) <= 0 THEN
    NEW.amount := NEW.amount_original;
  ELSIF NEW.discount_type = 'percentage' THEN
    IF NEW.referral_reward_id IS NOT NULL THEN
      NEW.amount := GREATEST(round(NEW.amount_original - NEW.amount_original * LEAST(NEW.discount_value, 100) / 100), 0);
    ELSE
      NEW.amount := GREATEST(round((NEW.amount_original - NEW.amount_original * LEAST(NEW.discount_value, 100) / 100) / 1000) * 1000, 0);
    END IF;
  ELSIF NEW.discount_type = 'nominal' THEN
    NEW.amount := GREATEST(round(NEW.amount_original - LEAST(NEW.discount_value, NEW.amount_original)), 0);
  END IF;
  RETURN NEW;
END;
$function$;

-- Perbaiki recap referral yang sudah terlanjur bernominal penuh. Invoice sudah terbit, jadi
-- trigger dikunci dengan app.soap_first_rpc. apply_discount_to_amount dimatikan sementara karena
-- ia menganggap perubahan amount sebagai amount_original baru (diskon terpotong dua kali).
ALTER TABLE public.daily_recaps DISABLE TRIGGER before_insert_update_apply_discount;
DO $$
BEGIN
  PERFORM set_config('app.soap_first_rpc', 'on', true);
  UPDATE public.daily_recaps d
  SET amount = CASE d.discount_type
        WHEN 'percentage' THEN GREATEST(round(d.amount_original - d.amount_original * LEAST(d.discount_value, 100) / 100), 0)
        ELSE GREATEST(round(d.amount_original - LEAST(d.discount_value, d.amount_original)), 0)
      END
  WHERE d.referral_reward_id IS NOT NULL
    AND d.invoice_created_at IS NOT NULL
    AND COALESCE(d.discount_value, 0) > 0
    AND d.amount = d.amount_original;
  PERFORM set_config('app.soap_first_rpc', 'off', true);
END $$;
ALTER TABLE public.daily_recaps ENABLE TRIGGER before_insert_update_apply_discount;
