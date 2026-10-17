-- Portal pasien Clinara: data keluhan/terapis yang terbaru, dan booking jadwal online.
--
-- 1. portal_get_home dulu hanya membaca rekap harian yang diagnosis_labels-nya terisi. Rekap hari ini
--    sering belum punya label (diagnosis tersimpan sebagai id, assessment ada di SOAP), sehingga portal
--    terus menampilkan keluhan dan terapis dari sesi lama. Sekarang:
--      * terapis  = terapis rekap terbaru (label diagnosis tidak disyaratkan)
--      * keluhan  = assessment SOAP terbaru bila satu baris pendek dan tidak lebih lama dari label rekap,
--                   selain itu label diagnosis rekap terbaru yang punya label
--    Ditambah therapist_id untuk prioritas booking.
-- 2. portal_get_booking_options / portal_get_booking_slots / portal_book_appointment: pasien memilih
--    terapis dan slot dari portal. Terapis terakhir yang menangani diprioritaskan, terapis lain tetap
--    ditawarkan. Booking memakai create_appointment_safe (pemeriksaan slot/bentrok tetap di sana).
--
-- Tanpa DROP dan tanpa DELETE. Tubuh fungsi memakai $fn$.

create or replace function public.portal_get_home(p_session text)
returns jsonb
language plpgsql security definer stable
set search_path = public, extensions
as $fn$
declare
  s record; v_pat record; v_c record; v_next jsonb; v_note text;
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
    'next_appointment', v_next, 'latest_note', left(v_note, 600), 'vas_series', v_vas,
    'vas_first', v_vas_first, 'vas_latest', v_vas_last, 'streak_days', v_streak,
    'week', v_week, 'program_total', v_total, 'program_done_today', v_done,
    'unread_messages', v_unread);
end
$fn$;

-- Terapis yang bisa dipilih pasien. Terapis terakhir (rekap terbaru, atau janji terakhir bila belum ada
-- rekap) ditandai dan diurutkan pertama.
create or replace function public.portal_get_booking_options(p_session text)
returns jsonb
language plpgsql security definer stable
set search_path = public, extensions
as $fn$
declare s record; v_last uuid;
begin
  select * into s from public.portal_resolve_session(p_session);

  select dr.therapist_id into v_last from public.daily_recaps dr
    where dr.patient_id = s.patient_id and dr.therapist_id is not null
    order by dr.recap_date desc, dr.created_at desc limit 1;
  if v_last is null then
    select a.therapist_id into v_last from public.appointments a
      where a.patient_id = s.patient_id and a.therapist_id is not null and a.status <> 'cancelled'
      order by a.appointment_date desc limit 1;
  end if;
  if v_last is not null and not exists (
       select 1 from public.physiotherapists t
       where t.id = v_last and t.clinic_id = s.clinic_id and t.is_active and t.show_on_booking) then
    v_last := null;
  end if;

  return jsonb_build_object(
    'last_therapist_id', v_last,
    'therapists', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', t.id, 'name', t.name, 'avatar_url', t.avatar_url,
          'specialization', t.specialization, 'is_last', t.id = v_last)
        order by (t.id = v_last) desc, t.name)
      from public.physiotherapists t
      where t.clinic_id = s.clinic_id and t.is_active and t.show_on_booking), '[]'::jsonb));
end
$fn$;

-- Slot kosong beberapa hari ke depan (hari ini sampai p_days - 1), semua terapis yang bisa dipilih.
-- Slot yang kurang dari 30 menit lagi tidak ditawarkan.
create or replace function public.portal_get_booking_slots(p_session text, p_days int default 14)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $fn$
declare s record; v_out jsonb := '[]'::jsonb; v_day date; v_n int := least(greatest(coalesce(p_days, 14), 1), 21);
begin
  select * into s from public.portal_resolve_session(p_session);
  for i in 0 .. v_n - 1 loop
    v_day := current_date + i;
    v_out := v_out || coalesce((
      select jsonb_agg(jsonb_build_object(
          'date', v_day, 'therapist_id', x.therapist_id,
          'start', to_char(x.slot_start, 'HH24:MI'), 'end', to_char(x.slot_end, 'HH24:MI'),
          'minutes', x.duration_minutes) order by x.slot_start)
      from public.get_available_slots_with_status_by_date(v_day, s.clinic_id) x
      join public.physiotherapists t on t.id = x.therapist_id
      where x.status = 'aktif' and t.is_active and t.show_on_booking and t.clinic_id = s.clinic_id
        and (v_day + x.slot_start)::timestamptz > now() + interval '30 minutes'), '[]'::jsonb);
  end loop;
  return v_out;
end
$fn$;

create or replace function public.portal_book_appointment(
  p_session text, p_therapist_id uuid, p_date date, p_time time, p_note text default null)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $fn$
declare
  s record; v_pat record; v_slot record; v_ts timestamptz; v_id uuid; v_name text; v_upcoming int;
begin
  select * into s from public.portal_resolve_session(p_session);
  if p_therapist_id is null or p_date is null or p_time is null then
    raise exception 'Pilih terapis, tanggal, dan jam' using errcode = '22023';
  end if;
  if length(coalesce(p_note, '')) > 500 then
    raise exception 'Catatan terlalu panjang' using errcode = '22023';
  end if;

  select t.name into v_name from public.physiotherapists t
    where t.id = p_therapist_id and t.clinic_id = s.clinic_id and t.is_active and t.show_on_booking;
  if v_name is null then
    raise exception 'Terapis tidak tersedia untuk booking' using errcode = 'P0002';
  end if;

  select count(*) into v_upcoming from public.appointments a
    where a.patient_id = s.patient_id and a.appointment_date > now() and a.status in ('confirmed', 'pending');
  if v_upcoming >= 3 then
    raise exception 'Anda sudah punya 3 jadwal mendatang. Hubungi klinik untuk menambah atau mengubah.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.appointments a
             where a.patient_id = s.patient_id and a.status in ('confirmed', 'pending')
               and a.appointment_date::date = p_date) then
    raise exception 'Anda sudah punya jadwal di tanggal itu. Pilih tanggal lain.' using errcode = 'P0001';
  end if;

  select x.slot_start, x.duration_minutes into v_slot
    from public.get_available_slots_with_status_by_date(p_date, s.clinic_id) x
    where x.therapist_id = p_therapist_id and x.slot_start = p_time and x.status = 'aktif';
  if not found then
    raise exception 'Slot ini sudah terisi. Pilih jam lain.' using errcode = 'P0001';
  end if;

  v_ts := (p_date + p_time)::timestamptz;
  if v_ts < now() + interval '30 minutes' then
    raise exception 'Slot ini terlalu dekat. Pilih jam lain.' using errcode = 'P0001';
  end if;

  select full_name, phone into v_pat from public.patients where id = s.patient_id;

  v_id := public.create_appointment_safe(
    p_therapist_id, v_ts, coalesce(v_slot.duration_minutes, 60), s.patient_id, 'confirmed', s.clinic_id,
    '[Portal Pasien]' || coalesce(' ' || nullif(btrim(p_note), ''), ''),
    null, v_pat.full_name, v_pat.phone, false, false, null, null, null, false,
    nullif(btrim(p_note), ''), null, null);

  update public.appointments set booking_source = 'portal' where id = v_id;

  return jsonb_build_object('appointment_id', v_id, 'appointment_date', v_ts, 'therapist', v_name);
end
$fn$;

revoke all on function public.portal_get_booking_options(text), public.portal_get_booking_slots(text, int),
  public.portal_book_appointment(text, uuid, date, time, text) from public;
grant execute on function public.portal_get_booking_options(text), public.portal_get_booking_slots(text, int),
  public.portal_book_appointment(text, uuid, date, time, text) to anon, authenticated;
