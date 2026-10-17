-- Portal pasien Clinara: jadwal terapis yang bisa dilihat dan dibooking dibatasi 10 hari ke depan.
-- Booking online (halaman publik klinik) tidak berubah.
-- Tanpa DROP dan tanpa DELETE; hanya create or replace dengan tanda tangan yang sama.

-- Slot kosong 10 hari ke depan (hari ini sampai hari ke-10; p_days dibatasi maksimum 10), semua terapis yang bisa dipilih.
-- Slot yang kurang dari 30 menit lagi tidak ditawarkan.
create or replace function public.portal_get_booking_slots(p_session text, p_days int default 10)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $fn$
declare s record; v_out jsonb := '[]'::jsonb; v_day date; v_n int := least(greatest(coalesce(p_days, 10), 1), 10);
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

  if p_date < current_date or p_date > current_date + 9 then
    raise exception 'Booking lewat portal hanya untuk 10 hari ke depan. Hubungi klinik untuk jadwal lebih jauh.' using errcode = 'P0001';
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

grant execute on function public.portal_get_booking_slots(text, int),
  public.portal_book_appointment(text, uuid, date, time, text) to anon, authenticated;
