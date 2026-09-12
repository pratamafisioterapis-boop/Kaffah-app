-- Link feedback pasien per klinik: staff (owner/admin) generate link unik
-- untuk seorang pasien, pasien buka link tsb (tanpa login) untuk kasih
-- rating + komentar. Rating tinggi (>=4) diarahkan ke halaman "Tulis Ulasan
-- Google" klinik (butuh google_place_id klinik terisi), rating rendah
-- disimpan internal saja supaya tidak nyasar jadi ulasan publik negatif.
-- Response yang di-approve staff bisa dipakai sebagai testimoni di website.

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS google_place_id text;

COMMENT ON COLUMN public.clinics.google_place_id IS 'Place ID Google Business Profile klinik, dipakai untuk membentuk link "Tulis Ulasan Google" (search.google.com/local/writereview?placeid=...) pada fitur feedback pasien.';

CREATE TABLE IF NOT EXISTS public.patient_feedback_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  patient_name text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_feedback_links_clinic_id
  ON public.patient_feedback_links (clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_feedback_links_token
  ON public.patient_feedback_links (token);

ALTER TABLE public.patient_feedback_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access patient_feedback_links"
  ON public.patient_feedback_links
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Owner manage own clinic feedback links"
  ON public.patient_feedback_links
  FOR ALL
  USING (
    get_my_role() = 'super_admin'
    OR (get_my_role() = ANY (ARRAY['owner', 'admin']) AND clinic_id = get_my_clinic_id())
  )
  WITH CHECK (
    get_my_role() = 'super_admin'
    OR (get_my_role() = ANY (ARRAY['owner', 'admin']) AND clinic_id = get_my_clinic_id())
  );

CREATE TABLE IF NOT EXISTS public.patient_feedback_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.patient_feedback_links(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_name text,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  is_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_feedback_responses_clinic_id
  ON public.patient_feedback_responses (clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_feedback_responses_link_id
  ON public.patient_feedback_responses (link_id);

ALTER TABLE public.patient_feedback_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access patient_feedback_responses"
  ON public.patient_feedback_responses
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Owner manage own clinic feedback responses"
  ON public.patient_feedback_responses
  FOR ALL
  USING (
    get_my_role() = 'super_admin'
    OR (get_my_role() = ANY (ARRAY['owner', 'admin']) AND clinic_id = get_my_clinic_id())
  )
  WITH CHECK (
    get_my_role() = 'super_admin'
    OR (get_my_role() = ANY (ARRAY['owner', 'admin']) AND clinic_id = get_my_clinic_id())
  );

-- Lookup publik (anon, tanpa login) info sebuah link feedback dari token-nya,
-- dipakai halaman /feedback/:token untuk menampilkan nama klinik dan
-- mengecek apakah link sudah pernah diisi.
CREATE OR REPLACE FUNCTION public.get_feedback_link_info(p_token text)
RETURNS TABLE (
  clinic_name text,
  patient_name text,
  already_responded boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.name, l.patient_name, (l.responded_at IS NOT NULL)
  FROM public.patient_feedback_links l
  JOIN public.clinics c ON c.id = l.clinic_id
  WHERE l.token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_feedback_link_info(text) TO anon, authenticated;

-- Submit publik (anon) sebuah response feedback lewat token. Mengunci link
-- supaya tidak bisa diisi dua kali, lalu mengembalikan link "Tulis Ulasan
-- Google" HANYA jika rating >= 4 DAN klinik sudah punya google_place_id --
-- rating rendah tidak pernah diarahkan ke Google.
CREATE OR REPLACE FUNCTION public.submit_patient_feedback(
  p_token text,
  p_rating smallint,
  p_comment text
)
RETURNS TABLE (
  success boolean,
  google_review_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.patient_feedback_links%ROWTYPE;
  v_place_id text;
  v_review_url text := NULL;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  SELECT * INTO v_link
  FROM public.patient_feedback_links
  WHERE token = p_token AND responded_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  INSERT INTO public.patient_feedback_responses (link_id, clinic_id, patient_name, rating, comment)
  VALUES (v_link.id, v_link.clinic_id, v_link.patient_name, p_rating, NULLIF(TRIM(p_comment), ''));

  UPDATE public.patient_feedback_links
  SET responded_at = now()
  WHERE id = v_link.id;

  IF p_rating >= 4 THEN
    SELECT google_place_id INTO v_place_id FROM public.clinics WHERE id = v_link.clinic_id;
    IF v_place_id IS NOT NULL AND TRIM(v_place_id) <> '' THEN
      v_review_url := 'https://search.google.com/local/writereview?placeid=' || v_place_id;
    END IF;
  END IF;

  RETURN QUERY SELECT true, v_review_url;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_patient_feedback(text, smallint, text) TO anon, authenticated;

-- Daftar publik (anon) feedback yang sudah di-approve staff untuk sebuah
-- klinik, dipakai landing page untuk menampilkan testimoni dari feedback
-- pasien nyata (bukan hanya data statis).
CREATE OR REPLACE FUNCTION public.get_public_feedback(p_clinic_id uuid)
RETURNS TABLE (
  patient_name text,
  rating smallint,
  comment text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.patient_name, r.rating, r.comment, r.created_at
  FROM public.patient_feedback_responses r
  WHERE r.clinic_id = p_clinic_id AND r.is_approved = true
  ORDER BY r.created_at DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_feedback(uuid) TO anon, authenticated;
