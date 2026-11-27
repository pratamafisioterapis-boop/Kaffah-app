-- Kwitansi WhatsApp: verifikasi status pengiriman SEBENARNYA dari Meta (via Watzap).
--
-- Masalah (Pak Brilian, 27 Nov 2026): Watzap menjawab 200 + wamid saat menerima permintaan, sehingga
-- invoice_wa_sends 'terkirim'. Beberapa detik kemudian Meta menolak pesan (error 131049) dan kwitansi tidak
-- pernah sampai, tetapi badge tetap "terkirim" dan kuesioner (yang menunggu kwitansi 'terkirim') tetap jalan.
--
-- Perbaikan: cron tiap menit menanyakan status tiap kwitansi 'terkirim' ke Watzap (/v1/messages action=status,
-- sama seperti fungsi wa-watzap-status). Bila statusnya 'failed' -> invoice_wa_sends 'gagal' + detail alasan,
-- dan badge rekap (daily_recaps.invoice_wa_status) menjadi 'gagal' bila ini kiriman terbaru. Kuesioner otomatis
-- yang belum diproses ikut dilewati (aturan "kwitansi gagal terkirim").
--
-- Dua tahap tanpa menunggu (pg_net asinkron): tahap 1 membaca balasan permintaan sebelumnya, tahap 2 mengirim
-- permintaan baru. Pengecekan dilanjutkan sampai status 'delivered'/'read'/'failed' atau 30 menit sejak kirim.
-- Kwitansi lama yang belum pernah dicek (<3 hari) dicek sekali.
--
-- Rollback: supabase/manual/rollback_invoice_wa_verify_delivery.sql

BEGIN;

ALTER TABLE public.invoice_wa_sends
  ADD COLUMN IF NOT EXISTS delivery_status     text,
  ADD COLUMN IF NOT EXISTS delivery_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS verify_request_id   bigint;

CREATE OR REPLACE FUNCTION public.invoice_wa_verify_run()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  r record;
  body jsonb;
  d jsonb;
  e jsonb;
  v_st text;
  v_detail text;
  v_key text;
  v_req bigint;
  n integer := 0;
BEGIN
  -- Tahap 1: baca balasan pengecekan sebelumnya.
  FOR s IN SELECT * FROM public.invoice_wa_sends WHERE verify_request_id IS NOT NULL ORDER BY id LIMIT 50 LOOP
    BEGIN
      SELECT status_code, content INTO r FROM net._http_response WHERE id = s.verify_request_id;
      IF NOT FOUND THEN
        IF s.delivery_checked_at < now() - interval '5 minutes' THEN
          UPDATE public.invoice_wa_sends SET verify_request_id = NULL WHERE id = s.id;
        END IF;
        CONTINUE;
      END IF;

      BEGIN
        body := r.content::jsonb;
      EXCEPTION WHEN others THEN
        body := NULL;
      END;
      d := body->'data';
      v_st := d->>'status';

      IF r.status_code = 200 AND v_st IN ('sent', 'delivered', 'read', 'failed') THEN
        IF v_st = 'failed' THEN
          e := jsonb_path_query_first(coalesce(d->'status_history', '[]'::jsonb), '$[*] ? (@.status == "failed")') -> 'raw' -> 'errors' -> 0;
          v_detail := left(
            coalesce(e->>'code', '') || ' ' ||
            coalesce(e->'error_data'->>'details', e->>'title', e->>'message', d->>'error', 'Gagal terkirim'),
            300);
          v_detail := 'Ditolak WhatsApp: ' || btrim(v_detail);

          UPDATE public.invoice_wa_sends
             SET status = 'gagal', detail = v_detail, delivery_status = 'failed', verify_request_id = NULL
           WHERE id = s.id;
          UPDATE public.daily_recaps
             SET invoice_wa_status = 'gagal'
           WHERE id = s.recap_id
             AND invoice_wa_status = 'terkirim'
             AND s.id = (SELECT max(id) FROM public.invoice_wa_sends WHERE recap_id = s.recap_id);
          n := n + 1;
        ELSE
          UPDATE public.invoice_wa_sends
             SET delivery_status = v_st, verify_request_id = NULL
           WHERE id = s.id;
        END IF;
      ELSE
        -- Kena batas laju / balasan tak terbaca: coba lagi di putaran berikutnya.
        UPDATE public.invoice_wa_sends SET verify_request_id = NULL WHERE id = s.id;
      END IF;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'invoice_wa_verify_run (baca) %: %', s.id, SQLERRM;
      UPDATE public.invoice_wa_sends SET verify_request_id = NULL WHERE id = s.id;
    END;
  END LOOP;

  -- Tahap 2: kirim permintaan cek untuk kwitansi 'terkirim' yang belum final.
  FOR s IN
    SELECT * FROM public.invoice_wa_sends
     WHERE status = 'terkirim' AND wamid IS NOT NULL AND verify_request_id IS NULL
       AND coalesce(delivery_status, '') NOT IN ('delivered', 'read', 'failed')
       AND created_at > now() - interval '3 days'
       AND created_at < now() - interval '15 seconds'
       AND (delivery_checked_at IS NULL
            OR (delivery_checked_at < now() - interval '50 seconds' AND created_at > now() - interval '30 minutes'))
     ORDER BY id
     LIMIT 10
  LOOP
    BEGIN
      SELECT api_key INTO v_key FROM public.wa_settings WHERE clinic_id = s.clinic_id LIMIT 1;
      IF v_key IS NULL THEN
        UPDATE public.invoice_wa_sends SET delivery_checked_at = now(), delivery_status = 'unknown' WHERE id = s.id;
        CONTINUE;
      END IF;
      v_req := net.http_post(
        url := 'https://api.watzap.id/v1/messages',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object('api_key', v_key, 'action', 'status', 'message_id', s.wamid),
        timeout_milliseconds := 20000
      );
      UPDATE public.invoice_wa_sends SET verify_request_id = v_req, delivery_checked_at = now() WHERE id = s.id;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'invoice_wa_verify_run (kirim) %: %', s.id, SQLERRM;
    END;
  END LOOP;

  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.invoice_wa_verify_run() FROM PUBLIC, anon, authenticated;

COMMIT;

SELECT cron.schedule('invoice-wa-verify', '* * * * *', $$SELECT public.invoice_wa_verify_run()$$);
