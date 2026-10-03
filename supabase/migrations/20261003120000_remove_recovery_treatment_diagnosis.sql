-- Hapus diagnosa "Recovery Treatment" di semua klinik (termasuk template
-- subjective/objective yang tersimpan di baris operational_options, serta
-- edukasi & rencana latihan per diagnosa). Data pasien yang sudah terlanjur
-- terlink ke diagnosa tersebut dialihkan ke "DOMS" (per klinik).

-- 1. Pemetaan Recovery Treatment -> DOMS per klinik (DOMS dibuat jika belum ada).
insert into public.operational_options (category, label, is_active, clinic_id, subjective_template, objective_template)
select 'diagnosa', 'DOMS', true, rt.clinic_id,
       (select d.subjective_template from public.operational_options d where d.category = 'diagnosa' and d.label = 'DOMS' and d.subjective_template is not null limit 1),
       (select d.objective_template from public.operational_options d where d.category = 'diagnosa' and d.label = 'DOMS' and d.objective_template is not null limit 1)
from public.operational_options rt
where rt.category = 'diagnosa' and lower(btrim(rt.label)) = 'recovery treatment'
  and not exists (
    select 1 from public.operational_options d
    where d.category = 'diagnosa' and d.clinic_id is not distinct from rt.clinic_id and lower(btrim(d.label)) = 'doms'
  );

create temp table _rt_map on commit drop as
select rt.id::text as rt_id, d.id::text as doms_id
from public.operational_options rt
join lateral (
  select id from public.operational_options d
  where d.category = 'diagnosa' and d.clinic_id is not distinct from rt.clinic_id and lower(btrim(d.label)) = 'doms'
  order by d.created_at limit 1
) d on true
where rt.category = 'diagnosa' and lower(btrim(rt.label)) = 'recovery treatment';

-- Ganti satu elemen jsonb (id / label) dan buang duplikat tanpa mengubah urutan.
create or replace function pg_temp.swap_rt(arr jsonb) returns jsonb language sql as $$
  select coalesce(jsonb_agg(v order by first_pos), '[]'::jsonb)
  from (
    select v, min(pos) as first_pos
    from (
      select pos,
        case
          when e #>> '{}' in (select rt_id from _rt_map) then to_jsonb((select doms_id from _rt_map where rt_id = e #>> '{}'))
          when e #>> '{}' ilike '%recovery treatment%' then to_jsonb('DOMS'::text)
          else e
        end as v
      from jsonb_array_elements(arr) with ordinality as t(e, pos)
    ) s group by v
  ) g
$$;

-- 2. Link pasien: rekap harian.
update public.daily_recaps
set diagnosis = case when jsonb_typeof(diagnosis) = 'array' then pg_temp.swap_rt(diagnosis) else diagnosis end,
    diagnosis_ids = case when jsonb_typeof(diagnosis_ids) = 'array' then pg_temp.swap_rt(diagnosis_ids) else diagnosis_ids end,
    diagnosis_labels = case when jsonb_typeof(diagnosis_labels) = 'array' then pg_temp.swap_rt(diagnosis_labels) else diagnosis_labels end
where diagnosis::text ilike '%recovery treatment%'
   or diagnosis_labels::text ilike '%recovery treatment%'
   or diagnosis_ids::text ilike '%recovery treatment%'
   or exists (select 1 from _rt_map m where diagnosis::text like '%' || m.rt_id || '%' or diagnosis_ids::text like '%' || m.rt_id || '%');

-- 3. Link pasien: rekam medis & rotasi.
update public.medical_records_detailed
set medical_diagnosis = regexp_replace(medical_diagnosis, 'recovery treatment', 'DOMS', 'gi')
where medical_diagnosis ilike '%recovery treatment%';

update public.medical_records_detailed r
set medical_diagnosis = replace(r.medical_diagnosis, m.rt_id, m.doms_id)
from _rt_map m
where r.medical_diagnosis like '%' || m.rt_id || '%';

update public.rotasi_patients
set diagnosis = regexp_replace(diagnosis, 'recovery treatment', 'DOMS', 'gi')
where diagnosis ilike '%recovery treatment%';

-- 4. Hapus diagnosa (template subjective/objective ikut terhapus bersama barisnya)
--    beserta edukasi & rencana latihan per diagnosa.
delete from public.operational_options
where category = 'diagnosa' and lower(btrim(label)) = 'recovery treatment';

delete from public.diagnosis_education where diagnosis_key = 'recovery treatment';
delete from public.diagnosis_exercise_plans where diagnosis_key = 'recovery treatment';
