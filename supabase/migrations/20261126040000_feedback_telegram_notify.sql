-- Respons kuesioner feedback Kaffah langsung dikirim ke Telegram (grup notifikasi yang sama
-- dengan notifikasi booking, lewat edge function send-telegram).
-- Trigger AFTER INSERT di patient_feedback_responses, jadi berlaku apa pun fungsi submit-nya.
-- Kegagalan Telegram tidak boleh menggagalkan penyimpanan feedback.
BEGIN;

CREATE OR REPLACE FUNCTION public.notify_feedback_telegram()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_secret text;
  v_text text;
BEGIN
  IF NEW.clinic_id <> 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid THEN
    RETURN NEW;
  END IF;
  BEGIN
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets WHERE name = 'telegram_internal_secret' LIMIT 1;
    IF v_secret IS NULL THEN RETURN NEW; END IF;

    v_text := '📝 Feedback pasien baru' || E'\n' ||
              'Pasien : ' || COALESCE(NULLIF(btrim(NEW.patient_name), ''), '-') || E'\n' ||
              'Rating : ' || repeat('⭐', GREATEST(NEW.rating, 0)) || ' (' || NEW.rating || '/5)' ||
              COALESCE(E'\n\n' || NEW.comment, '');

    PERFORM net.http_post(
      url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-telegram',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_secret),
      body := jsonb_build_object('event', 'feedback_baru', 'clinic_id', NEW.clinic_id, 'text', v_text),
      timeout_milliseconds := 10000
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.notify_feedback_telegram() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_feedback_telegram ON public.patient_feedback_responses;
CREATE TRIGGER trg_feedback_telegram
AFTER INSERT ON public.patient_feedback_responses
FOR EACH ROW EXECUTE FUNCTION public.notify_feedback_telegram();

COMMIT;
