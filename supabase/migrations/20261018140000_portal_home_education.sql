-- Portal pasien: edukasi yang ditulis terapis di SOAP (kolom medical_records.education) tampil di beranda.
-- portal_get_home menambah 'latest_education' = edukasi dari SOAP terbaru yang terisi; null bila tidak ada,
-- sehingga portal menyembunyikan kartunya. Selain itu isi fungsi sama dengan 20261017130000.
--
-- Tanpa DROP dan tanpa DELETE. Tubuh fungsi memakai $fn$.

create or replace function public.portal_get_home(p_session text)
returns jsonb
language plpgsql security definer stable
set search_path = public, extensions
as $fn$
declare
  s record; v_pat record; v_c record; v_next jsonb; v_note text; v_edu text;
  v_total int; v_done int; v_unread int; v_vas jsonb; v_week jsonb;
  v_sessions int; v_streak int := 0; v_i int := 0;
  v_vas_first smallint; v_vas_last smallint;
  v_therapist text; v_therapist_id uuid;
  v_label text; v_label_date date;
  v_assess text; v_assess_date date; v_complaint text;
begin
  select * into s from public.portal_resolve_session(p_session);
  select coalesce(nullif(nickname, ''), split_part(full_name, ' ', 1)) as first_name into v_pat
    from public.patients where id = s.patient_id;
  select name, logo_url, coalesce(portal_brand_color, landing_primary_color) as color into v_c
    from public.clinics where id = s.clinic_id;

  -- terapis: rekap terbaru yang punya nama terapis
  select nullif(btrim(dr.therapist_name), ''), dr.therapist_id into v_therapist, v_therapist_id
    from public.daily_recaps dr
    where dr.patient_id = s.patient_id and nullif(btrim(dr.therapist_name), '') is not null
    order by dr.recap_date desc, dr.created_at desc limit 1;

  -- keluhan: label diagnosis dari rekap terbaru yang berlabel ...
  select dr.diagnosis_labels->>0, dr.recap_date into v_label, v_label_date
    from public.daily_recaps dr
    where dr.patient_id = s.patient_id and jsonb_typeof(dr.diagnosis_labels) = 'array'
      and jsonb_typeof(dr.diagnosis_labels->0) = 'string'
      and nullif(btrim(dr.diagnosis_labels->>0), '') is not null
    order by dr.recap_date desc, dr.created_at desc limit 1;
  -- ... atau assessment SOAP terbaru bila ringkas (satu baris, maks. 80 karakter)
  select btrim(split_part(btrim(mr.assessment), E'\n', 1)), mr.created_at::date into v_assess, v_assess_date
    from public.medical_records mr
    where mr.patient_id = s.patient_id and nullif(btrim(mr.assessment), '') is not null
    order by mr.created_at desc limit 1;
  if v_assess is not null and char_length(v_assess) > 80 then v_assess := null; end if;
  v_complaint := case when v_assess is not null and (v_label is null or v_assess_date >= v_label_date)
                      then v_assess else v_label end;

  select jsonb_build_object('appointment_date', a.appointment_date, 'therapist', t.name)
    into v_next
    from public.appointments a left join public.physiotherapists t on t.id = a.therapist_id
    where a.patient_id = s.patient_id and a.appointment_date > now() and a.status = 'confirmed'
    order by a.appointment_date limit 1;

  select count(*) into v_sessions from public.medical_records where patient_id = s.patient_id;

  select nullif(btrim(plan_data->>'notes'), '') into v_note from public.medical_records
    where patient_id = s.patient_id and nullif(btrim(plan_data->>'notes'), '') is not null
    order by created_at desc limit 1;

  select nullif(btrim(mr.education), '') into v_edu from public.medical_records mr
    where mr.patient_id = s.patient_id and nullif(btrim(mr.education), '') is not null
    order by mr.created_at desc limit 1;

  select coalesce(jsonb_agg(n order by d), '[]'::jsonb) into v_vas from (
    select public.portal_extract_nprs(mr.objective) as n, mr.created_at as d
    from public.medical_records mr
    where mr.patient_id = s.patient_id and public.portal_extract_nprs(mr.objective) is not null
    order by mr.created_at desc limit 12) x;
  select (array_agg(n order by d))[1], (array_agg(n order by d desc))[1] into v_vas_first, v_vas_last from (
    select public.portal_extract_nprs(mr.objective) as n, mr.created_at as d
    from public.medical_records mr
    where mr.patient_id = s.patient_id and public.portal_extract_nprs(mr.objective) is not null) y;

  select count(*), count(l.id) into v_total, v_done
    from public.portal_program_items(s.patient_id) p
    left join public.patient_exercise_logs l
      on l.patient_id = s.patient_id and l.exercise_id = p.exercise_id and l.done_on = current_date and l.is_done;

  select jsonb_agg(jsonb_build_object('date', d::date, 'done',
           exists (select 1 from public.patient_exercise_logs l where l.patient_id = s.patient_id and l.done_on = d::date and l.is_done),
           'today', d::date = current_date) order by d)
    into v_week
    from generate_series(date_trunc('week', current_date), date_trunc('week', current_date) + interval '6 days', interval '1 day') d;

  loop
    exit when v_i > 365;
    if exists (select 1 from public.patient_exercise_logs l
               where l.patient_id = s.patient_id and l.done_on = current_date - v_i and l.is_done) then
      v_streak := v_streak + 1;
    elsif v_i > 0 then
      exit;
    end if;
    v_i := v_i + 1;
  end loop;

  select count(*) into v_unread from public.patient_portal_messages
    where patient_id = s.patient_id and sender = 'therapist' and read_at is null;

  return jsonb_build_object('first_name', v_pat.first_name,
    'clinic', jsonb_build_object('name', v_c.name, 'logo_url', v_c.logo_url, 'brand_color', v_c.color),
    'complaint', v_complaint, 'therapist', v_therapist, 'therapist_id', v_therapist_id,
    'sessions_done', v_sessions,
    'next_appointment', v_next, 'latest_note', left(v_note, 600), 'latest_education', left(v_edu, 4000), 'vas_series', v_vas,
    'vas_first', v_vas_first, 'vas_latest', v_vas_last, 'streak_days', v_streak,
    'week', v_week, 'program_total', v_total, 'program_done_today', v_done,
    'unread_messages', v_unread);
end
$fn$;
