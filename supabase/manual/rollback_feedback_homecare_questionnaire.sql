-- Rollback 20261127090000_feedback_homecare_questionnaire.sql
BEGIN;
DROP TRIGGER IF EXISTS trg_feedback_wa_mark_homecare ON public.feedback_wa_queue;
DROP FUNCTION IF EXISTS public.feedback_wa_mark_link_homecare();
DROP FUNCTION IF EXISTS public.get_feedback_link_is_homecare(text);

CREATE OR REPLACE FUNCTION public.get_feedback_questionnaire(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.feedback_questionnaire
  FROM public.patient_feedback_links l
  JOIN public.clinics c ON c.id = l.clinic_id
  WHERE l.token = p_token
  LIMIT 1;
$$;

ALTER TABLE public.clinics DROP COLUMN IF EXISTS feedback_questionnaire_homecare;
ALTER TABLE public.patient_feedback_links DROP COLUMN IF EXISTS is_homecare;
COMMIT;
