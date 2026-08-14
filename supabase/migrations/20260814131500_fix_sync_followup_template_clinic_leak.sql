-- sync_followup_template() runs after any wa_templates edit and copies the
-- new template text into every still-pending queue row of that type — but it
-- never filtered by clinic_id, so editing one clinic's template overwrote
-- *every* clinic's pending queue with that clinic's raw text (discovered
-- while fixing the follow_up template above: updating Kaffah's and Grand
-- Physiocare's follow_up templates in the same statement left every pending
-- follow_up row — both clinics' — showing Grand Physiocare's unrendered
-- text). Scope every branch to the editing clinic.
--
-- The 'follow_up' branch additionally re-renders through
-- render_follow_up_message() (keyed by each row's own source_id/source_table)
-- instead of copying the raw template, so the patient's name stays filled in
-- rather than reverting to a literal "[nickname]".
CREATE OR REPLACE FUNCTION public.sync_followup_template()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN

  -- Birthday
  IF NEW.category = 'birthday' THEN
    UPDATE follow_up_queue
    SET message_content = NEW.template_text
    WHERE follow_up_type = 'birthday_greeting'
    AND status = 'pending'
    AND clinic_id = NEW.clinic_id;
  END IF;

  -- Therapy Reminder
  IF NEW.category = 'therapy_reminder' THEN
    UPDATE follow_up_queue
    SET message_content = NEW.template_text
    WHERE follow_up_type = 'therapy_reminder'
    AND status = 'pending'
    AND clinic_id = NEW.clinic_id;
  END IF;

  -- Booking
  IF NEW.category = 'booking_appointment' THEN
    UPDATE follow_up_queue
    SET message_content = NEW.template_text
    WHERE follow_up_type = 'booking_appointment'
    AND status = 'pending'
    AND clinic_id = NEW.clinic_id;
  END IF;

  -- Follow Up H+1
  IF NEW.category = 'follow_up' THEN
    UPDATE follow_up_queue fq
    SET message_content = render_follow_up_message(NEW.template_text, fq.source_id, fq.source_table)
    WHERE fq.follow_up_type = 'follow_up'
    AND fq.status = 'pending'
    AND fq.clinic_id = NEW.clinic_id;
  END IF;

  -- Package Expiry
  IF NEW.category = 'package_expiry' THEN
    UPDATE follow_up_queue
    SET message_content = NEW.template_text
    WHERE follow_up_type = 'expiry_package'
    AND status = 'pending'
    AND clinic_id = NEW.clinic_id;
  END IF;

  RETURN NEW;
END;
$function$;
