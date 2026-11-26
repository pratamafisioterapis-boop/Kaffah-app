-- Rollback 20261125160000_kaffah_feedback_wa_auto.sql
SELECT cron.unschedule('feedback-wa-run');
DROP TRIGGER IF EXISTS trg_feedback_wa_enqueue ON public.invoice_wa_sends;
DROP FUNCTION IF EXISTS public.feedback_wa_run();
DROP FUNCTION IF EXISTS public.feedback_wa_process_one(bigint);
DROP FUNCTION IF EXISTS public.feedback_wa_resolve_one(bigint);
DROP FUNCTION IF EXISTS public.feedback_wa_enqueue_from_invoice();
DROP TABLE IF EXISTS public.feedback_wa_queue;
DROP TABLE IF EXISTS public.feedback_wa_config;
