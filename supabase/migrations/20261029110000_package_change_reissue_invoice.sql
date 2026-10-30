-- Ubah paket (invoice terbit): invoice lama harus diterbitkan ulang dengan nominal baru.
-- PDF lama (invoice_url) dilepas sehingga InvoiceModal membuat PDF baru saat dikirim/diunduh,
-- dan link /i/<recap> tidak lagi menampilkan nominal lama. Nomor kwitansi tetap sama.
CREATE OR REPLACE FUNCTION public.package_change_apply(p_recap_id uuid, p_clinic uuid, p_label text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_q jsonb;
BEGIN
  PERFORM 1 FROM daily_recaps WHERE id = p_recap_id AND clinic_id = p_clinic FOR UPDATE;
  v_q := package_change_quote(p_recap_id, p_clinic, p_label);
  UPDATE daily_recaps
  SET package_type = v_q ->> 'package_label',
      welcome_reward_used = false,
      birthday_reward_year = NULL,
      referral_reward_id = NULL,
      discount_referral_code = NULL,
      discount_type = NULL,
      discount_value = 0,
      discount_label = NULL,
      amount_original = (v_q ->> 'total')::numeric,
      amount = (v_q ->> 'total')::numeric,
      invoice_url = NULL,
      updated_at = now()
  WHERE id = p_recap_id AND clinic_id = p_clinic;

  UPDATE invoice_records SET amount = (v_q ->> 'total')::numeric WHERE daily_recap_id = p_recap_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.package_change_apply(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
