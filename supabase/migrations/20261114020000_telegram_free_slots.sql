-- Jadwal kosong untuk bot Telegram (perintah /kosong).
--
-- Sumber slot sama dengan halaman booking: therapist_slots (slot_date,
-- is_available) untuk terapis aktif, dikurangi slot yang sudah dipesan
-- (appointments confirmed/ongoing dengan jam mulai yang sama; aturan sama
-- dengan public.get_available_slots). Ditambah: slot terapis yang sedang cuti
-- disaring, karena tabel slot tidak mengikuti cuti. Untuk hari ini, slot yang
-- sudah lewat tidak ditampilkan.
--
-- Dipanggil Edge Function telegram-webhook lewat RPC dengan service_role.
-- Pembungkus public.tg_free_slots dicabut dari public/anon/authenticated.

create or replace function tgreport.free_slots_text(p_date date)
returns text
language plpgsql stable security definer set search_path = public, tgreport as $fn$
declare
  v_today date := (now() at time zone 'Asia/Makassar')::date;
  v_hdr text;
  v_total int := 0;
  v_all int;
  lines text[] := '{}';
  r record;
begin
  v_hdr := '📅 JADWAL KOSONG' || E'\n' || tgreport.dayname(p_date) || ', ' ||
           extract(day from p_date)::int || ' ' || tgreport.monthname(p_date) || ' ' || extract(year from p_date)::int ||
           case when p_date = v_today then ' (hari ini, yang belum lewat)' else '' end;

  select count(*) into v_all
  from public.therapist_slots ts
  join public.physiotherapists p on p.id = ts.therapist_id
  where ts.slot_date = p_date and ts.is_available and p.is_active and p.clinic_id = tgreport.clinic_id();

  if v_all = 0 then
    return v_hdr || E'\n\n' || 'Belum ada slot terjadwal pada tanggal ini.';
  end if;

  for r in
    with s as (
      select ts.therapist_id, ts.slot_start_time as st, ts.slot_end_time as en,
             ((ts.slot_date + ts.slot_start_time) at time zone 'Asia/Makassar') as s_ts,
             regexp_replace(split_part(btrim(p.name), ' ', 1), '[,.]+$', '') as nm
      from public.therapist_slots ts
      join public.physiotherapists p on p.id = ts.therapist_id
      where ts.slot_date = p_date and ts.is_available and p.is_active
        and p.clinic_id = tgreport.clinic_id()
    )
    select s.nm,
           string_agg(to_char(s.st, 'HH24.MI') || '-' || to_char(s.en, 'HH24.MI'), ', ' order by s.st) as jam,
           count(*)::int as n
    from s
    where (p_date <> v_today or s.s_ts > now())
      and not exists (
        select 1 from public.appointments a
        where a.therapist_id = s.therapist_id and a.appointment_date = s.s_ts
          and a.status in ('confirmed', 'ongoing'))
      and not exists (
        select 1 from public.therapist_time_off o
        where o.therapist_id = s.therapist_id and p_date between o.start_date and o.end_date
          and (o.start_time is null or o.end_time is null or (s.st < o.end_time and s.en > o.start_time)))
    group by s.nm
    order by min(s.st), s.nm
  loop
    lines := lines || (r.nm || ' (' || r.n || '): ' || r.jam);
    v_total := v_total + r.n;
  end loop;

  if v_total = 0 then
    return v_hdr || E'\n\n' || 'Tidak ada slot kosong.';
  end if;
  return v_hdr || E'\n\n' || array_to_string(lines, E'\n') || E'\n\n' || 'Total ' || v_total || ' slot kosong';
end
$fn$;

create or replace function public.tg_free_slots(p_date date)
returns text
language sql security definer set search_path = public, tgreport as $fn$
  select tgreport.free_slots_text(p_date)
$fn$;

revoke all on function tgreport.free_slots_text(date) from public, anon, authenticated;
revoke all on function public.tg_free_slots(date) from public, anon, authenticated;
grant execute on function public.tg_free_slots(date) to service_role;
