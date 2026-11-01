-- invoice_wa_poll: ambil balasan Watzap yang terlambat untuk satu permintaan send_invoice_whatsapp.
--
-- send_invoice_whatsapp hanya menunggu ~6 detik (batas statement_timeout authenticated = 8 detik).
-- Bila balasan Watzap lebih lambat, klien memanggil fungsi ini beberapa kali sampai balasan datang,
-- lalu menulis status invoice. Hanya mengembalikan kode HTTP dan isi balasan (tanpa data lain).
--
-- Rollback: DROP FUNCTION public.invoice_wa_poll(bigint);

CREATE OR REPLACE FUNCTION public.invoice_wa_poll(p_request_id bigint)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resp record;
BEGIN
  IF auth.uid() IS NULL OR COALESCE((SELECT get_my_role()), '') NOT IN ('admin', 'clinic_admin', 'owner', 'super_admin', 'therapist') THEN
    RAISE EXCEPTION 'Tidak berhak.';
  END IF;

  SELECT status_code, content INTO v_resp FROM net._http_response WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN json_build_object('done', false);
  END IF;

  RETURN json_build_object('done', true, 'status', v_resp.status_code, 'content', v_resp.content);
END;
$$;

REVOKE ALL ON FUNCTION public.invoice_wa_poll(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invoice_wa_poll(bigint) TO authenticated;
