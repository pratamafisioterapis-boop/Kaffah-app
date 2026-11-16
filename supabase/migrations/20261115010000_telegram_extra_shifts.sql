-- Perbaikan laporan malam dan /kosong Telegram: ikuti aturan jadwal aplikasi.
--
-- Masalah: terapis yang masuk lewat shift tambahan (therapist_extra_shifts,
-- mis. Alma 15 Nov 2026 pada hari libur mingguannya) dianggap cuti, karena
-- catatan weekly_off di therapist_time_off memblokir seluruh hari. Aplikasi
-- sendiri memakai dua aturan:
--   * jadwal rutin : diblokir oleh semua jenis cuti (public.time_off_blocks_slot)
--   * shift tambahan: diblokir oleh cuti SELAIN weekly_off
--                     (public.time_off_blocks_extra_slot)
-- Perubahan:
--   - tgreport.capacity: slot rutin + slot shift tambahan, tanpa duplikat
--   - tgreport.ther_rows: slot terjadwal dan status cuti memperhitungkan shift tambahan
--   - tgreport.free_slots_text: saringan cuti memakai aturan yang sesuai per slot
--   - build_nightly_report: daftar "Libur/cuti" tidak memuat terapis yang masuk
--     lewat shift tambahan, menampilkan jam bila cuti sebagian, dan baris
--     "Shift tambahan: ..."

create or replace function tgreport.capacity(p_date date) returns int
language sql stable security definer set search_path = public, tgreport as $fn$
  select count(*)::int from (
    select s.therapist_id, s.start_time
    from public.therapist_schedules s
    join public.physiotherapists p on p.id = s.therapist_id
    where s.clinic_id = tgreport.clinic_id()
      and s.is_active and p.is_active
      and (s.day_of_week = extract(dow from p_date)::int
           or (extract(dow from p_date) = 0 and s.day_of_week = 7))
      and not public.time_off_blocks_slot(s.therapist_id, p_date, s.start_time, s.end_time)
    union
    select e.therapist_id,
           (e.start_time + (g.k * e.slot_duration_minutes) * interval '1 minute')::time
    from public.therapist_extra_shifts e
    join public.physiotherapists p on p.id = e.therapist_id
    cross join lateral generate_series(
      0, greatest(floor(extract(epoch from (e.end_time - e.start_time)) / 60.0 / e.slot_duration_minutes)::int - 1, -1)
    ) as g(k)
    where p.clinic_id = tgreport.clinic_id() and p.is_active and e.shift_date = p_date
      and not public.time_off_blocks_extra_slot(
            e.therapist_id, p_date,
            (e.start_time + (g.k * e.slot_duration_minutes) * interval '1 minute')::time,
            (e.start_time + ((g.k + 1) * e.slot_duration_minutes) * interval '1 minute')::time)
  ) x
$fn$;

create or replace function tgreport.ther_rows(p_date date)
returns table(t_nm text, t_s int, t_rev numeric, t_per int, t_target int,
              t_pstart date, t_pend date, t_slots int, t_leave boolean)
language sql stable security definer set search_path = public, tgreport as $fn$
  with ther as (
    select p.id,
           regexp_replace(split_part(btrim(p.name), ' ', 1), '[,.]+$', '') as nm,
           t.start_date, t.end_date, t.target_visits, t.excluded_patient_types
    from public.physiotherapists p
    left join public.therapist_targets t
      on t.therapist_id = p.id and p_date between t.start_date and t.end_date
    where p.clinic_id = tgreport.clinic_id() and p.is_active
  ), today as (
    select dr.therapist_id, count(*)::int as s, coalesce(sum(dr.amount), 0) as rev
    from public.daily_recaps dr
    where dr.clinic_id = tgreport.clinic_id()
      and dr.recap_date = p_date
      and dr.status is distinct from 'cancelled'
    group by dr.therapist_id
  ), per as (
    select th.id, count(*)::int as n
    from ther th
    join public.daily_recaps dr
      on dr.therapist_id = th.id
     and dr.recap_date between th.start_date and p_date
     and dr.status is distinct from 'cancelled'
     and (th.excluded_patient_types is null
          or jsonb_array_length(th.excluded_patient_types) = 0
          or not (dr.patient_type = any (select jsonb_array_elements_text(th.excluded_patient_types))))
    where th.start_date is not null
    group by th.id
  )
  select th.nm, coalesce(td.s, 0), coalesce(td.rev, 0), coalesce(per.n, 0),
         th.target_visits, th.start_date, th.end_date,
         (select count(*)::int from public.therapist_schedules s
           where s.therapist_id = th.id and s.is_active
             and (s.day_of_week = extract(dow from p_date)::int
                  or (extract(dow from p_date) = 0 and s.day_of_week = 7)))
         + (select count(*)::int from public.therapist_extra_shifts e
             where e.therapist_id = th.id and e.shift_date = p_date),
         exists (select 1 from public.therapist_time_off o
                  where o.therapist_id = th.id and p_date between o.start_date and o.end_date)
         and not exists (select 1 from public.therapist_extra_shifts e
                          where e.therapist_id = th.id and e.shift_date = p_date)
  from ther th
  left join today td on td.therapist_id = th.id
  left join per on per.id = th.id
  where th.start_date is not null or coalesce(td.s, 0) > 0
$fn$;

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
      and not (
        case when exists (select 1 from public.therapist_extra_shifts e
                           where e.therapist_id = s.therapist_id and e.shift_date = p_date
                             and s.st >= e.start_time and s.en <= e.end_time)
             then public.time_off_blocks_extra_slot(s.therapist_id, p_date, s.st, s.en)
             else public.time_off_blocks_slot(s.therapist_id, p_date, s.st, s.en) end)
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

-- Tambalan build_nightly_report (aman dijalankan ulang: dilewati bila sudah ditambal).
do $do$
declare
  def text;
  old text;
  new text;
begin
  select pg_get_functiondef('tgreport.build_nightly_report(date)'::regprocedure) into def;
  if position('v_extra' in def) > 0 then
    return;
  end if;

  old := $a$  v_cap_n int; v_conf_n int; v_leave text;$a$;
  new := $a$  v_cap_n int; v_conf_n int; v_leave text; v_extra text;$a$;
  if position(old in def) = 0 then raise exception 'jangkar 1 tidak ditemukan'; end if;
  def := replace(def, old, new);

  old := $a$  select string_agg(distinct nm, ', ' order by nm) into v_leave from (
    select regexp_replace(split_part(btrim(p.name), ' ', 1), '[,.]+$', '') as nm
    from public.therapist_time_off t
    join public.physiotherapists p on p.id = t.therapist_id
    where p.clinic_id = c and p.is_active and d + 1 between t.start_date and t.end_date
  ) x;$a$;
  new := $a$  select string_agg(distinct nm, ', ' order by nm) into v_leave from (
    select regexp_replace(split_part(btrim(p.name), ' ', 1), '[,.]+$', '') ||
           case when t.start_time is not null and t.end_time is not null
                then ' (' || to_char(t.start_time, 'HH24.MI') || '-' || to_char(t.end_time, 'HH24.MI') || ')'
                else '' end as nm
    from public.therapist_time_off t
    join public.physiotherapists p on p.id = t.therapist_id
    where p.clinic_id = c and p.is_active and d + 1 between t.start_date and t.end_date
      and not (
        exists (select 1 from public.therapist_extra_shifts e where e.therapist_id = p.id and e.shift_date = d + 1)
        and not exists (select 1 from public.therapist_time_off t2
                         where t2.therapist_id = p.id and t2.leave_type <> 'weekly_off'
                           and d + 1 between t2.start_date and t2.end_date))
  ) x;

  select string_agg(nm || ' ' || to_char(mn, 'HH24.MI') || '-' || to_char(mx, 'HH24.MI'), ', ' order by nm) into v_extra from (
    select regexp_replace(split_part(btrim(p.name), ' ', 1), '[,.]+$', '') as nm,
           min(e.start_time) as mn, max(e.end_time) as mx
    from public.therapist_extra_shifts e
    join public.physiotherapists p on p.id = e.therapist_id
    where p.clinic_id = c and p.is_active and e.shift_date = d + 1
    group by 1
  ) x;$a$;
  if position(old in def) = 0 then raise exception 'jangkar 2 tidak ditemukan'; end if;
  def := replace(def, old, new);

  old := $a$case when v_leave is null then 'Tidak ada terapis cuti' else 'Cuti: ' || v_leave end;$a$;
  new := $a$case when v_leave is null then 'Tidak ada terapis libur/cuti' else 'Libur/cuti: ' || v_leave end ||
    case when v_extra is not null then E'\n' || 'Shift tambahan: ' || v_extra else '' end;$a$;
  if position(old in def) = 0 then raise exception 'jangkar 3 tidak ditemukan'; end if;
  def := replace(def, old, new);

  execute def;
end
$do$;

revoke all on all functions in schema tgreport from public, anon, authenticated;
