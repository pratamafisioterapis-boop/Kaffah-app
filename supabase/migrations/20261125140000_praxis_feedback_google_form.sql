-- Praxis: feedback diisi lewat Google Form (kuesioner), lalu langsung diarahkan
-- ke Google Review. Dua RPC publik (anon) berbasis token link feedback.

-- Mengembalikan clinic_id dari token (untuk memilih alur form di frontend).
CREATE OR REPLACE FUNCTION public.get_feedback_link_clinic_id(p_token text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.clinic_id FROM public.patient_feedback_links l WHERE l.token = p_token LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_feedback_link_clinic_id(text) TO anon, authenticated;

-- Menyimpan kuesioner Praxis (rating 1-5 dari kepuasan menyeluruh + ringkasan
-- jawaban di comment), mengunci link, dan SELALU mengembalikan link Google
-- Review klinik (alur Praxis: kuesioner -> langsung Google Review).
DROP FUNCTION IF EXISTS public.complete_praxis_feedback(text);

CREATE OR REPLACE FUNCTION public.submit_praxis_feedback(
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
    AND clinic_id = 'b25e8c29-6977-4e1b-b500-7629ec3aeb8a'::uuid
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

GRANT EXECUTE ON FUNCTION public.submit_praxis_feedback(text, smallint, text) TO anon, authenticated;
