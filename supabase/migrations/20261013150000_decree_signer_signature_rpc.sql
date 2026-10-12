-- Tanda tangan penandatangan SK untuk dibubuhkan di PDF yang dibuka terapis/admin.
-- Terapis tidak wajib boleh membaca data terapis lain, jadi diambil lewat fungsi
-- SECURITY DEFINER yang hanya melayani SK berstatus 'issued' di klinik pemanggil.
CREATE OR REPLACE FUNCTION public.get_decree_signer_signature(p_decree_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
  select p.signature_url
  from clinic_leadership_decrees d
  join physiotherapists p on p.clinic_id = d.clinic_id
  where d.id = p_decree_id
    and d.status = 'issued'
    and d.clinic_id in (select u.clinic_id from users u where u.id = auth.uid())
    and lower(regexp_replace(split_part(p.name, ',', 1), '[^a-zA-Z]', '', 'g'))
        = lower(regexp_replace(split_part(coalesce(d.signer_name, ''), ',', 1), '[^a-zA-Z]', '', 'g'))
    and p.signature_url is not null
  limit 1;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_decree_signer_signature(uuid) TO authenticated;
