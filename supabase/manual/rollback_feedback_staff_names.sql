-- Rollback 20261126010000_feedback_staff_names.sql
DROP FUNCTION IF EXISTS public.get_feedback_staff(text);

UPDATE public.clinics c
   SET feedback_questionnaire = (
     SELECT jsonb_agg(
              CASE WHEN q->>'id' = 'staff'
                   THEN (q || jsonb_build_object('type', 'text'))
                   ELSE q END
              ORDER BY ord)
       FROM jsonb_array_elements(c.feedback_questionnaire) WITH ORDINALITY AS t(q, ord)
   )
 WHERE c.id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
   AND jsonb_typeof(c.feedback_questionnaire) = 'array';
