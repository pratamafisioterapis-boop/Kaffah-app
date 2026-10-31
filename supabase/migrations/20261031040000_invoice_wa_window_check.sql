-- Cek jendela 24 jam WhatsApp sebelum kirim invoice PDF otomatis.
--
-- Latar belakang: PDF dinamis dikirim lewat jalur Watzap non-resmi (waba_send_file_url). Jalur itu
-- tidak tercatat di log pesan Watzap (/messages), jadi hasil pengiriman tidak bisa diverifikasi, dan
-- Meta menolak pesan non-template di luar 24 jam sejak pesan terakhir pasien TANPA error ke pemanggil.
-- Akibatnya badge invoice hijau walau pesan tidak sampai.
--
-- Fungsi ini memberi tahu klien apakah jendela terbuka, dari wa_inbox_conversations (pesan masuk
-- pasien yang sudah dicatat inbox). Hanya klinik dengan inbox aktif yang bisa dicek.
--
-- Rollback: DROP FUNCTION public.invoice_wa_window(text);

CREATE OR REPLACE FUNCTION public.invoice_wa_window(p_phone text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := (SELECT get_my_clinic_id());
  v_phone  text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_enabled boolean;
  v_last   timestamptz;
BEGIN
  IF auth.uid() IS NULL OR v_clinic IS NULL THEN
    RETURN json_build_object('checkable', false);
  END IF;

  IF v_phone LIKE '0%' THEN
    v_phone := '62' || substring(v_phone FROM 2);
  END IF;

  SELECT coalesce(inbox_enabled, false) INTO v_enabled
    FROM public.wa_settings WHERE clinic_id = v_clinic LIMIT 1;

  IF NOT coalesce(v_enabled, false) THEN
    RETURN json_build_object('checkable', false);
  END IF;

  SELECT max(last_inbound_at) INTO v_last
    FROM public.wa_inbox_conversations
   WHERE clinic_id = v_clinic AND wa_id = v_phone;

  RETURN json_build_object(
    'checkable', true,
    'last_inbound_at', v_last,
    'open', coalesce(v_last > now() - interval '24 hours', false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invoice_wa_window(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invoice_wa_window(text) TO authenticated;
