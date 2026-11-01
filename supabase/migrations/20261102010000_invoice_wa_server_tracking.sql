-- Pelacakan pengiriman invoice WhatsApp di SERVER (menggantikan penulisan status oleh browser).
--
-- Masalah: PDF dikirim dari database, tetapi invoice_wa_status ditulis terpisah oleh browser sesudahnya.
-- Bila aplikasi versi lama, halaman dimuat ulang, balasan Watzap lambat, atau koneksi putus di antara dua
-- langkah itu, PDF sampai tetapi badge kosong (kasus Al Qaishar 1 Nov 2026).
--
-- Rancangan baru:
--   1. invoice_wa_dispatch  : kirim ke Watzap + catat baris di invoice_wa_sends + status 'mengirim', langsung kembali.
--   2. invoice_wa_resolve   : dipanggil browser tiap beberapa detik; menyelesaikan satu pengiriman.
--   3. invoice_wa_resolve_pending + pg_cron tiap menit: jaring pengaman, menyelesaikan yang tidak sempat.
--   Keputusan akhir (terkirim/gagal) selalu dibuat di server dari balasan Watzap (HTTP 200 DAN body status 200).
--
-- Tidak menyentuh send_invoice_whatsapp / invoice_wa_poll (dipakai klien lama) maupun fungsi invoice_wa_send*.
--
-- Rollback: supabase/manual/rollback_invoice_wa_server_tracking.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.invoice_wa_sends (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recap_id    uuid NOT NULL REFERENCES public.daily_recaps(id) ON DELETE CASCADE,
  clinic_id   uuid NOT NULL,
  phone       text NOT NULL,
  request_id  bigint NOT NULL,
  status      text NOT NULL DEFAULT 'mengirim' CHECK (status IN ('mengirim', 'terkirim', 'gagal')),
  detail      text,
  wamid       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_invoice_wa_sends_recap ON public.invoice_wa_sends (recap_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_wa_sends_pending ON public.invoice_wa_sends (created_at) WHERE status = 'mengirim';

-- Hanya diakses lewat fungsi SECURITY DEFINER di bawah.
ALTER TABLE public.invoice_wa_sends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_wa_sends FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Penyelesai satu pengiriman (internal): baca balasan Watzap dari pg_net, tetapkan status akhir.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.invoice_wa_resolve_one(p_send_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  r record;
  body jsonb;
  v_status text;
  v_detail text;
  v_wamid text;
BEGIN
  SELECT * INTO s FROM public.invoice_wa_sends WHERE id = p_send_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF s.status <> 'mengirim' THEN RETURN s.status; END IF;

  SELECT status_code, content, error_msg INTO r FROM net._http_response WHERE id = s.request_id;

  IF NOT FOUND THEN
    IF s.created_at < now() - interval '10 minutes' THEN
      v_status := 'gagal';
      v_detail := 'Respons Watzap tidak ditemukan (kedaluwarsa)';
    ELSE
      RETURN 'mengirim';
    END IF;
  ELSE
    BEGIN
      body := r.content::jsonb;
    EXCEPTION WHEN others THEN
      body := NULL;
    END;

    IF r.status_code = 200 AND body->>'status' = '200' THEN
      v_status := 'terkirim';
      v_wamid := body->>'wamid';
    ELSE
      v_status := 'gagal';
      v_detail := left(coalesce(body->>'message', r.error_msg, left(r.content, 200), 'HTTP ' || coalesce(r.status_code::text, '?')), 300);
    END IF;
  END IF;

  UPDATE public.invoice_wa_sends
     SET status = v_status, detail = v_detail, wamid = v_wamid, resolved_at = now()
   WHERE id = s.id;

  -- Hanya pengiriman TERBARU untuk rekap ini yang boleh mengubah badge, dan hanya bila masih 'mengirim'
  -- (kiriman manual/ulang yang lebih baru tidak ditimpa oleh balasan lama).
  UPDATE public.daily_recaps
     SET invoice_wa_status = v_status
   WHERE id = s.recap_id
     AND invoice_wa_status = 'mengirim'
     AND s.id = (SELECT max(id) FROM public.invoice_wa_sends WHERE recap_id = s.recap_id);

  RETURN v_status;
END;
$$;
REVOKE ALL ON FUNCTION public.invoice_wa_resolve_one(bigint) FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Jaring pengaman untuk cron: selesaikan semua yang masih 'mengirim'.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.invoice_wa_resolve_pending()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  n integer := 0;
BEGIN
  FOR s IN
    SELECT id FROM public.invoice_wa_sends
     WHERE status = 'mengirim' AND created_at > now() - interval '7 days'
     ORDER BY id
  LOOP
    PERFORM public.invoice_wa_resolve_one(s.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.invoice_wa_resolve_pending() FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Kirim: validasi, kirim ke Watzap, catat, langsung kembali (tanpa menunggu balasan).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.invoice_wa_dispatch(
  p_recap_id uuid,
  p_phone text,
  p_caption text,
  p_file_url text,
  p_filename text DEFAULT 'invoice.pdf'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid;
  v_role text := COALESCE((SELECT get_my_role()), '');
  v_key text;
  v_number_key text;
  v_phone text;
  v_req bigint;
  v_id bigint;
BEGIN
  SELECT clinic_id INTO v_clinic FROM public.daily_recaps WHERE id = p_recap_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recap tidak ditemukan.'; END IF;

  IF auth.uid() IS NULL
     OR v_role NOT IN ('owner', 'admin', 'clinic_admin', 'therapist', 'super_admin')
     OR (v_role <> 'super_admin' AND v_clinic IS DISTINCT FROM (SELECT get_my_clinic_id())) THEN
    RAISE EXCEPTION 'Anda tidak berhak mengirim invoice ini.';
  END IF;

  IF coalesce(p_file_url, '') = '' THEN RAISE EXCEPTION 'URL file invoice kosong.'; END IF;

  SELECT api_key, number_key INTO v_key, v_number_key
    FROM public.wa_settings WHERE clinic_id = v_clinic LIMIT 1;
  IF v_key IS NULL THEN RAISE EXCEPTION 'API WhatsApp belum diatur untuk klinik ini.'; END IF;

  v_phone := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  IF v_phone LIKE '0%' THEN v_phone := '62' || substr(v_phone, 2); END IF;
  IF length(v_phone) < 9 THEN RAISE EXCEPTION 'Nomor WhatsApp pasien tidak valid.'; END IF;

  -- timeout 30 dtk: bawaan pg_net hanya 5 dtk, sedangkan Watzap bisa membalas ~3,5 dtk atau lebih lambat;
  -- timeout pendek mencatat "gagal" walau pesan sebenarnya terkirim.
  v_req := net.http_post(
    url := 'https://api.watzap.id/v1/waba_send_file_url',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'api_key', v_key,
      'number_key', COALESCE(v_number_key, 'ALL'),
      'phone_no', v_phone,
      'url', p_file_url,
      'filename', p_filename,
      'caption', COALESCE(p_caption, '')
    ),
    timeout_milliseconds := 30000
  );

  INSERT INTO public.invoice_wa_sends (recap_id, clinic_id, phone, request_id)
  VALUES (p_recap_id, v_clinic, v_phone, v_req)
  RETURNING id INTO v_id;

  UPDATE public.daily_recaps
     SET invoice_wa_status = 'mengirim', invoice_wa_sent_at = now()
   WHERE id = p_recap_id;

  RETURN json_build_object('send_id', v_id, 'request_id', v_req);
END;
$$;
REVOKE ALL ON FUNCTION public.invoice_wa_dispatch(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invoice_wa_dispatch(uuid, text, text, text, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Dipanggil browser untuk memperbarui satu pengiriman (cron tetap jaring pengaman).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.invoice_wa_resolve(p_send_id bigint)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid;
  v_role text := COALESCE((SELECT get_my_role()), '');
  v_status text;
  v_detail text;
BEGIN
  SELECT clinic_id INTO v_clinic FROM public.invoice_wa_sends WHERE id = p_send_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pengiriman tidak ditemukan.'; END IF;

  IF auth.uid() IS NULL
     OR v_role NOT IN ('owner', 'admin', 'clinic_admin', 'therapist', 'super_admin')
     OR (v_role <> 'super_admin' AND v_clinic IS DISTINCT FROM (SELECT get_my_clinic_id())) THEN
    RAISE EXCEPTION 'Tidak berhak.';
  END IF;

  v_status := public.invoice_wa_resolve_one(p_send_id);
  SELECT detail INTO v_detail FROM public.invoice_wa_sends WHERE id = p_send_id;
  RETURN json_build_object('status', v_status, 'detail', v_detail);
END;
$$;
REVOKE ALL ON FUNCTION public.invoice_wa_resolve(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invoice_wa_resolve(bigint) TO authenticated;

COMMIT;

-- Jaring pengaman tiap menit (idempotent: nama sama = memperbarui jadwal).
SELECT cron.schedule('invoice-wa-resolve', '* * * * *', $$SELECT public.invoice_wa_resolve_pending()$$);
