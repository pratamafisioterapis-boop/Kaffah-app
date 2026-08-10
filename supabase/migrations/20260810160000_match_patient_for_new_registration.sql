-- Smart Booking "Pasien Baru" step: suggest an existing patient match so the
-- patient can confirm "ini saya" instead of accidentally creating a duplicate
-- medical record. Requires at least 2 of 3 signals (phone, birth date, last
-- name) to agree before a candidate is even surfaced; the caller still shows
-- it to the patient for an explicit yes/no before linking to avoid wrong-ID
-- mixups from a shared family phone number.
CREATE OR REPLACE FUNCTION public.match_patient_for_new_registration(
  p_full_name text,
  p_phone text,
  p_birth_date date,
  p_clinic_id uuid
)
RETURNS TABLE(
  id uuid,
  full_name text,
  nickname text,
  birth_date date,
  phone character varying,
  gender character varying,
  medical_record_number character varying
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name_parts text[];
  v_last_name text;
  v_phone_digits text;
BEGIN
  v_name_parts := regexp_split_to_array(trim(coalesce(p_full_name, '')), '\s+');
  v_last_name := v_name_parts[array_length(v_name_parts, 1)];
  v_phone_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');

  RETURN QUERY
  SELECT p.id, p.full_name, p.nickname, p.birth_date, p.phone, p.gender, p.medical_record_number
  FROM patients p
  WHERE p.status = 'aktif'
    AND p.clinic_id = p_clinic_id
    AND (
      (CASE WHEN v_phone_digits <> '' AND regexp_replace(p.phone, '\D', '', 'g') = v_phone_digits THEN 1 ELSE 0 END)
      + (CASE WHEN p_birth_date IS NOT NULL AND p.birth_date = p_birth_date THEN 1 ELSE 0 END)
      + (CASE WHEN coalesce(v_last_name, '') <> '' AND p.full_name ILIKE '%' || v_last_name THEN 1 ELSE 0 END)
    ) >= 2
  ORDER BY
    (CASE WHEN v_phone_digits <> '' AND regexp_replace(p.phone, '\D', '', 'g') = v_phone_digits THEN 1 ELSE 0 END)
    + (CASE WHEN p_birth_date IS NOT NULL AND p.birth_date = p_birth_date THEN 1 ELSE 0 END)
    + (CASE WHEN coalesce(v_last_name, '') <> '' AND p.full_name ILIKE '%' || v_last_name THEN 1 ELSE 0 END) DESC
  LIMIT 3;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.match_patient_for_new_registration(text, text, date, uuid) TO anon, authenticated;
