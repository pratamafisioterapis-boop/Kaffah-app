-- Goal treatment di portal pasien (Clinara).
-- Terapis mengisi goal di Plan SOAP (hanya klinik yang fitur Clinara-nya aktif): plan_data.goals =
-- [{ "id": "g…", "text": "…", "progress": 0-100 }]. Goal dibawa dari SOAP ke SOAP dengan id yang sama,
-- sehingga progresnya bisa dilacak. Portal menampilkan goal dari SOAP terbaru yang memuatnya
-- beserta riwayat progres per sesi. Tidak ada tabel baru dan tidak ada perubahan skema.
-- Aman dijalankan ulang (create or replace); tanpa DROP/DELETE.

create or replace function public.portal_get_goals(p_session text)
returns jsonb
language plpgsql security definer stable
set search_path = public, extensions
as $fn$
declare s record; v_goals jsonb;
begin
  select * into s from public.portal_resolve_session(p_session);

  select mr.plan_data->'goals' into v_goals
    from public.medical_records mr
    where mr.patient_id = s.patient_id
      and jsonb_typeof(mr.plan_data->'goals') = 'array'
      and jsonb_array_length(mr.plan_data->'goals') > 0
    order by mr.created_at desc limit 1;
  if v_goals is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', g.gid,
        'text', left(g.gtext, 300),
        'progress', g.prog,
        'history', coalesce((
          select jsonb_agg(jsonb_build_object('date', h.d, 'progress', h.p) order by h.d, h.ca)
          from (select mr.created_at::date as d, mr.created_at as ca,
                       least(100, greatest(0, (e->>'progress')::int)) as p
                from public.medical_records mr,
                     jsonb_array_elements(mr.plan_data->'goals') e
                where mr.patient_id = s.patient_id
                  and jsonb_typeof(mr.plan_data->'goals') = 'array'
                  and e->>'id' = g.gid
                  and (e->>'progress') ~ '^[0-9]{1,3}$') h), '[]'::jsonb))
      order by g.ord)
    from (select e->>'id' as gid, nullif(btrim(e->>'text'), '') as gtext,
                 case when (e->>'progress') ~ '^[0-9]{1,3}$'
                      then least(100, greatest(0, (e->>'progress')::int)) else 0 end as prog,
                 ord
          from jsonb_array_elements(v_goals) with ordinality as t(e, ord)
          where nullif(btrim(e->>'id'), '') is not null) g
    where g.gtext is not null), '[]'::jsonb);
end
$fn$;

grant execute on function public.portal_get_goals(text) to anon;
