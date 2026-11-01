-- Rollback pelacakan pengiriman invoice WhatsApp di server (migrasi 20261102010000).
-- Aman dijalankan ulang. Klien lama tetap memakai send_invoice_whatsapp / invoice_wa_poll.
-- Rekap yang sedang 'mengirim' diselesaikan lebih dulu ke 'terkirim'/'gagal' lewat penyelesai,
-- lalu sisanya dipaksa 'gagal' agar badge tidak menggantung.

SELECT public.invoice_wa_resolve_pending();
UPDATE public.daily_recaps SET invoice_wa_status = 'gagal' WHERE invoice_wa_status = 'mengirim';

SELECT cron.unschedule('invoice-wa-resolve')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoice-wa-resolve');

DROP FUNCTION IF EXISTS public.invoice_wa_resolve(bigint);
DROP FUNCTION IF EXISTS public.invoice_wa_dispatch(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.invoice_wa_resolve_pending();
DROP FUNCTION IF EXISTS public.invoice_wa_resolve_one(bigint);
DROP TABLE IF EXISTS public.invoice_wa_sends;
