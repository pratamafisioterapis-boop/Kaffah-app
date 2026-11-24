-- Peringkat terapis untuk rekomendasi AI WhatsApp (pasien baru yang bertanya "fisionya siapa yang cocok?").
-- Skor: sesi yang cocok usia (+-10 tahun) DAN keluhan x3, sesi keluhan serupa x1, sesi usia serupa x0.05,
-- bonus kecil bila pasien 55+ dan terapis bertanda 'lansia'. Data: daily_recaps 12 bulan terakhir
-- (diagnosis_labels) + tanggal lahir pasien. Hanya service_role.
create or replace function public.ai_recommend_therapists(
  p_clinic_id uuid,
  p_age int,
  p_keywords text[],
  p_candidate_ids uuid[] default null,
  p_gender text default null
)
returns table(
  therapist_id uuid, name text, gender text, tags jsonb,
  sessions_age int, patients_age int,
  sessions_complaint int, patients_complaint int,
  sessions_both int, patients_both int,
  score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with kw as (
    select '%' || replace(replace(replace(lower(trim(k)), '\', ''), '%', ''), '_', '') || '%' as pat
    from unnest(coalesce(p_keywords, '{}'::text[])) k
    where length(trim(k)) >= 3
  ),
  base as (
    select r.therapist_id,
           coalesce(r.actual_patient_id, r.patient_id) as pid,
           lower(r.diagnosis_labels::text) as dl,
           date_part('year', age(r.recap_date, p.birth_date)) as umur
    from daily_recaps r
    join patients p on p.id = coalesce(r.actual_patient_id, r.patient_id)
    where r.clinic_id = p_clinic_id
      and r.recap_date >= current_date - interval '12 months'
      and p.birth_date is not null
      and r.therapist_id is not null
  ),
  flag as (
    select b.therapist_id, b.pid,
           (p_age is not null and b.umur between p_age - 10 and p_age + 10) as in_age,
           exists (select 1 from kw where b.dl like kw.pat) as has_c
    from base b
  ),
  agg as (
    select f.therapist_id,
      count(*) filter (where in_age)::int as sa,
      count(distinct pid) filter (where in_age)::int as pa,
      count(*) filter (where has_c)::int as sc,
      count(distinct pid) filter (where has_c)::int as pc,
      count(*) filter (where in_age and has_c)::int as sb,
      count(distinct pid) filter (where in_age and has_c)::int as pb
    from flag f group by f.therapist_id
  )
  select t.id, t.name, t.gender, coalesce(t.complaint_tags, '[]'::jsonb),
         coalesce(a.sa, 0), coalesce(a.pa, 0), coalesce(a.sc, 0), coalesce(a.pc, 0), coalesce(a.sb, 0), coalesce(a.pb, 0),
         (coalesce(a.sb, 0) * 3 + coalesce(a.sc, 0) + coalesce(a.sa, 0) * 0.05
           + case when p_age >= 55 and coalesce(t.complaint_tags, '[]'::jsonb) ? 'lansia' then 2 else 0 end)::numeric
  from physiotherapists t
  left join agg a on a.therapist_id = t.id
  where t.clinic_id = p_clinic_id and t.is_active
    and (p_candidate_ids is null or t.id = any (p_candidate_ids))
    and (p_gender is null or t.gender = p_gender)
  order by 11 desc, t.name
  limit 8;
$$;
revoke all on function public.ai_recommend_therapists(uuid, int, text[], uuid[], text) from public, anon, authenticated;
grant execute on function public.ai_recommend_therapists(uuid, int, text[], uuid[], text) to service_role;
