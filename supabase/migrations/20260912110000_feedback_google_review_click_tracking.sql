-- Google tidak menyediakan cara untuk memastikan pasien benar-benar submit
-- review di sana (tidak ada webhook/API untuk itu). Yang bisa kita lacak
-- hanyalah SINYAL NIAT: apakah pasien klik tombol "Tulis Ulasan di Google"
-- setelah diarahkan. Ini bukan bukti review sudah terkirim, hanya indikasi
-- kuat pasien melanjutkan ke Google.

ALTER TABLE public.patient_feedback_responses
  ADD COLUMN IF NOT EXISTS google_review_clicked_at timestamptz;

COMMENT ON COLUMN public.patient_feedback_responses.google_review_clicked_at IS 'Waktu pasien klik tombol "Tulis Ulasan di Google" setelah submit feedback. Bukan konfirmasi review benar-benar terkirim di Google -- Google tidak menyediakan cara untuk memverifikasi itu -- hanya sinyal niat/klik.';

-- Publik (anon) menandai bahwa pasien mengklik tombol menuju Google Review,
-- dipanggil dari halaman /feedback/:token. Hanya boleh menandai response
-- miliknya sendiri (lewat token) dan hanya sekali (tidak menimpa jika sudah
-- pernah tercatat).
CREATE OR REPLACE FUNCTION public.mark_feedback_google_review_clicked(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.patient_feedback_responses r
  SET google_review_clicked_at = now()
  FROM public.patient_feedback_links l
  WHERE r.link_id = l.id
    AND l.token = p_token
    AND r.google_review_clicked_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_feedback_google_review_clicked(text) TO anon, authenticated;
