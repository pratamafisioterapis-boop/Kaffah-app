-- 1) Link feedback terhubung ke data pasien (tanpa pasien mengetik identitas).
ALTER TABLE public.patient_feedback_links
  ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_patient_feedback_links_patient_id
  ON public.patient_feedback_links (patient_id);

-- 2) Kuesioner dipakai Praxis DAN Kaffah. Menggantikan submit_praxis_feedback.
DROP FUNCTION IF EXISTS public.submit_praxis_feedback(text, smallint, text);

CREATE OR REPLACE FUNCTION public.submit_questionnaire_feedback(
  p_token text,
  p_rating smallint,
  p_comment text
)
RETURNS TABLE (success boolean, google_review_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.patient_feedback_links%ROWTYPE;
  v_place_id text;
  v_url text := NULL;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  SELECT * INTO v_link
  FROM public.patient_feedback_links
  WHERE token = p_token
    AND responded_at IS NULL
    AND clinic_id IN (
      'b25e8c29-6977-4e1b-b500-7629ec3aeb8a'::uuid,  -- Praxis
      'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid   -- Kaffah
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  INSERT INTO public.patient_feedback_responses (link_id, clinic_id, patient_name, rating, comment)
  VALUES (v_link.id, v_link.clinic_id, v_link.patient_name, p_rating, NULLIF(TRIM(left(p_comment, 4000)), ''));

  UPDATE public.patient_feedback_links SET responded_at = now() WHERE id = v_link.id;

  SELECT google_place_id INTO v_place_id FROM public.clinics WHERE id = v_link.clinic_id;
  IF v_place_id IS NOT NULL AND TRIM(v_place_id) <> '' THEN
    v_url := 'https://search.google.com/local/writereview?placeid=' || v_place_id;
  END IF;

  RETURN QUERY SELECT true, v_url;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_questionnaire_feedback(text, smallint, text) TO anon, authenticated;
