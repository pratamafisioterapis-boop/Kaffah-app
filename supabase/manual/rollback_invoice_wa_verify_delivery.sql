SELECT cron.unschedule('invoice-wa-verify');
DROP FUNCTION IF EXISTS public.invoice_wa_verify_run();
ALTER TABLE public.invoice_wa_sends
  DROP COLUMN IF EXISTS delivery_status,
  DROP COLUMN IF EXISTS delivery_checked_at,
  DROP COLUMN IF EXISTS verify_request_id;
