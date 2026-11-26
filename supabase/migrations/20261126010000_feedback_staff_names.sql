-- Kuesioner feedback: pertanyaan "nama petugas" menjadi pilihan nama terapis aktif klinik.
--
-- Halaman kuesioner dibuka pasien TANPA login, jadi daftar terapis diambil lewat fungsi SECURITY DEFINER yang
-- memvalidasi token link: hanya link yang masih berlaku (belum diisi) yang mendapat daftar, dan yang keluar HANYA
-- nama panggilan terapis aktif di klinik link itu (tidak ada id, email, atau data lain).
--
-- Nama panggilan terapis tidak disimpan di tabel users, jadi diturunkan dari full_name:
--   "Adi Pratama,S.Fis.,Ftr" -> "Adi". Bila dua terapis aktif punya nama depan sama, dipakai dua kata pertama.
--
-- Kuesioner Kaffah yang sudah dikustomisasi: pertanyaan id 'staff' diubah dari 'text' ke 'therapist'.
-- Klinik tanpa kustomisasi (Praxis) memakai default di kode, yang juga memakai tipe 'therapist'.
--
-- Rollback: supabase/manual/rollback_feedback_staff_names.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.get_feedback_staff(p_token text)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH l AS (
    SELECT clinic_id FROM public.patient_feedback_links
     WHERE token = p_token AND responded_at IS NULL
     LIMIT 1
  ), t AS (
    SELECT btrim(split_part(u.full_name, ',', 1)) AS base
      FROM public.users u
      JOIN l ON l.clinic_id = u.clinic_id
     WHERE u.role = 'therapist' AND u.is_active
       AND btrim(coalesce(u.full_name, '')) <> ''
  ), w AS (
    SELECT split_part(base, ' ', 1) AS f,
           btrim(split_part(base, ' ', 1) || ' ' || split_part(base, ' ', 2)) AS f2
      FROM t
  )
  SELECT coalesce(array_agg(nick ORDER BY nick), ARRAY[]::text[])
    FROM (
      SELECT CASE WHEN count(*) OVER (PARTITION BY lower(f)) > 1 THEN f2 ELSE f END AS nick
        FROM w WHERE f <> ''
    ) x;
$$;
REVOKE ALL ON FUNCTION public.get_feedback_staff(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_feedback_staff(text) TO anon, authenticated;

UPDATE public.clinics c
   SET feedback_questionnaire = (
     SELECT jsonb_agg(
              CASE WHEN q->>'id' = 'staff'
                   THEN (q || jsonb_build_object('type', 'therapist', 'options', '[]'::jsonb))
                   ELSE q END
              ORDER BY ord)
       FROM jsonb_array_elements(c.feedback_questionnaire) WITH ORDINALITY AS t(q, ord)
   )
 WHERE c.id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
   AND jsonb_typeof(c.feedback_questionnaire) = 'array';

COMMIT;
