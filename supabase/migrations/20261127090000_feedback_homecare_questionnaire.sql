-- Kuesioner feedback khusus HOMECARE (terpisah dari kuesioner klinik).
--
--   * patient_feedback_links.is_homecare: penanda link. Link otomatis (WA 2 menit setelah kwitansi) ditandai dari
--     appointments.is_homecare milik kwitansi tersebut; link manual ditandai staf saat membuat link.
--   * clinics.feedback_questionnaire_homecare: pertanyaan homecare hasil kustomisasi owner (NULL = default di aplikasi).
--   * get_feedback_link_is_homecare(token): dipakai halaman /feedback/:token untuk memilih set pertanyaan.
--   * get_feedback_questionnaire(token): mengembalikan kuesioner homecare bila link homecare, selain itu kuesioner klinik.
--
-- Fungsi antrean WA (feedback_wa_process_one) TIDAK diubah: penanda dipasang oleh trigger di feedback_wa_queue saat
-- link_id terisi, jadi pengiriman WA yang sudah berjalan tidak tersentuh. Kegagalan trigger tidak pernah menggagalkan pengiriman.
--
-- Rollback: supabase/manual/rollback_feedback_homecare_questionnaire.sql

BEGIN;

ALTER TABLE public.patient_feedback_links ADD COLUMN IF NOT EXISTS is_homecare boolean NOT NULL DEFAULT false;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS feedback_questionnaire_homecare jsonb;

CREATE OR REPLACE FUNCTION public.get_feedback_link_is_homecare(p_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT l.is_homecare FROM public.patient_feedback_links l WHERE l.token = p_token LIMIT 1), false);
$$;
REVOKE ALL ON FUNCTION public.get_feedback_link_is_homecare(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_feedback_link_is_homecare(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_feedback_questionnaire(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN l.is_homecare THEN c.feedback_questionnaire_homecare ELSE c.feedback_questionnaire END
  FROM public.patient_feedback_links l
  JOIN public.clinics c ON c.id = l.clinic_id
  WHERE l.token = p_token
  LIMIT 1;
$$;

-- Tandai link otomatis sebagai homecare dari kunjungan pada kwitansi antrean.
CREATE OR REPLACE FUNCTION public.feedback_wa_mark_link_homecare()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF NEW.link_id IS NOT NULL AND NEW.link_id IS DISTINCT FROM OLD.link_id THEN
      UPDATE public.patient_feedback_links
         SET is_homecare = coalesce((
               SELECT a.is_homecare
                 FROM public.daily_recaps r
                 JOIN public.appointments a ON a.id = r.appointment_id
                WHERE r.id = NEW.recap_id), false)
       WHERE id = NEW.link_id AND responded_at IS NULL;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'feedback_wa_mark_link_homecare: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.feedback_wa_mark_link_homecare() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_feedback_wa_mark_homecare ON public.feedback_wa_queue;
CREATE TRIGGER trg_feedback_wa_mark_homecare
  AFTER UPDATE OF link_id ON public.feedback_wa_queue
  FOR EACH ROW EXECUTE FUNCTION public.feedback_wa_mark_link_homecare();

COMMIT;
