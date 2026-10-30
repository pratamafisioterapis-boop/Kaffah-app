-- send_follow_up_whatsapp memanggil Watzap lewat net.http_post (asinkron) dan
-- langsung menandai baris antrean 'completed' tanpa membaca balasan. Saat
-- Watzap menolak (mis. 401 "Invalid Secret Key") pesan tidak terkirim tetapi
-- aplikasi tetap menampilkan "Completed".
--
-- Perbaikan tanpa mengubah alur lama: simpan request_id pada baris antrean,
-- lalu reconcile_watzap_responses() (cron tiap menit) membaca
-- net._http_response dan membalik baris yang ditolak menjadi 'failed' lengkap
-- dengan alasannya. Status 'completed' tetap dipakai UI seperti biasa untuk
-- pengiriman yang diterima Watzap.

ALTER TABLE public.follow_up_queue
  ADD COLUMN IF NOT EXISTS watzap_request_id bigint,
  ADD COLUMN IF NOT EXISTS watzap_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_follow_up_queue_watzap_unchecked
  ON public.follow_up_queue (watzap_request_id)
  WHERE watzap_request_id IS NOT NULL AND watzap_checked_at IS NULL;

-- Ubah fungsi pengirim yang sedang berjalan secara in-place (bukan menulis
-- ulang seluruh badan fungsi), supaya sisanya persis sama dengan versi live.
DO $$
DECLARE
  v_def  text := pg_get_functiondef('public.send_follow_up_whatsapp'::regproc);
  v_old  text := $s$SET status = 'completed', sent_at = now(), failed_reason = NULL$s$;
  v_new  text := $s$SET status = 'completed', sent_at = now(), failed_reason = NULL,
        watzap_request_id = v_request_id, watzap_checked_at = NULL$s$;
BEGIN
  IF v_def LIKE '%watzap_request_id%' THEN
    RETURN; -- sudah terpasang
  END IF;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'send_follow_up_whatsapp berbeda dari yang diharapkan; migrasi dibatalkan';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $$;

CREATE OR REPLACE FUNCTION public.reconcile_watzap_responses()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, net
AS $function$
DECLARE
  rec record;
  v_failed integer := 0;
BEGIN
  FOR rec IN
    SELECT q.id, r.status_code, r.content, r.error_msg
    FROM follow_up_queue q
    JOIN net._http_response r ON r.id = q.watzap_request_id
    WHERE q.watzap_request_id IS NOT NULL
      AND q.watzap_checked_at IS NULL
  LOOP
    IF rec.status_code IS DISTINCT FROM 200
       OR rec.content ~* 'fatal_error'
       OR rec.content ~* '"status"\s*:\s*false' THEN
      UPDATE follow_up_queue
      SET status = 'failed',
          failed_reason = left(
            'Watzap menolak: ' || coalesce(nullif(rec.content, ''), rec.error_msg, 'HTTP ' || coalesce(rec.status_code::text, '?')),
            500),
          watzap_checked_at = now(),
          updated_at = now()
      WHERE id = rec.id;
      v_failed := v_failed + 1;
    ELSE
      UPDATE follow_up_queue SET watzap_checked_at = now() WHERE id = rec.id;
    END IF;
  END LOOP;
  RETURN v_failed;
END;
$function$;

REVOKE ALL ON FUNCTION public.reconcile_watzap_responses() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'reconcile_watzap_responses',
  '* * * * *',
  $$SELECT public.reconcile_watzap_responses();$$
);
