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

-- Menandai link sudah dipakai (kuesioner selesai di Google Form) dan
-- mengembalikan link Google Review klinik. Hanya untuk klinik Praxis.
CREATE OR REPLACE FUNCTION public.complete_praxis_feedback(p_token text)
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
  SELECT * INTO v_link
  FROM public.patient_feedback_links
  WHERE token = p_token
    AND clinic_id = 'b25e8c29-6977-4e1b-b500-7629ec3aeb8a'::uuid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  IF v_link.responded_at IS NULL THEN
    UPDATE public.patient_feedback_links SET responded_at = now() WHERE id = v_link.id;
  END IF;

  SELECT google_place_id INTO v_place_id FROM public.clinics WHERE id = v_link.clinic_id;
  IF v_place_id IS NOT NULL AND TRIM(v_place_id) <> '' THEN
    v_url := 'https://search.google.com/local/writereview?placeid=' || v_place_id;
  END IF;

  RETURN QUERY SELECT true, v_url;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_praxis_feedback(text) TO anon, authenticated;
