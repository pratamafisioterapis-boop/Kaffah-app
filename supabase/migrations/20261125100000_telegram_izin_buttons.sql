-- Pengajuan izin owner lewat tombol Telegram (perintah /izin).
--
-- Owner (Adi Pratama) memilih tanggal lalu jam praktik yang ingin dikosongkan
-- dengan tombol. Hasilnya baris therapist_time_off (izin pribadi, parsial per
-- slot atau seharian bila semua slot dipilih) untuk profil terapis owner.
-- Trigger trg_time_off_change yang sudah ada langsung membuat ulang slot, jadi
-- jadwal tertutup seperti bila izin dibuat dari aplikasi. Slot yang sudah
-- punya pasien tetap ada (aturan sistem); pasiennya ditampilkan sebagai
-- peringatan supaya bisa dijadwal ulang.
--
-- Dipanggil Edge Function telegram-webhook (service_role) setelah memastikan
-- pesan/klik berasal dari owner. Semua fungsi dicabut dari public/anon/authenticated.

create or replace function tgreport.izin_therapist() returns uuid
language sql stable security definer set search_path = public, tgreport as $fn$
  select p.id
  from public.users u
  join public.physiotherapists p
    on p.clinic_id = u.clinic_id and p.is_active
   and lower(p.name) like lower(btrim(u.full_name)) || '%'
  where u.clinic_id = tgreport.clinic_id() and u.role = 'owner' and coalesce(u.is_active, true)
  order by u.created_at, p.created_at
  limit 1
$fn$;

-- Tanggal (hari ini s/d 14 hari ke depan) yang masih punya slot milik owner.
create or replace function public.tg_izin_dates() returns jsonb
language plpgsql stable security definer set search_path = public, tgreport as $fn$
declare
  v_t uuid := tgreport.izin_therapist();
  v_today date := (now() at time zone 'Asia/Makassar')::date;
begin
  if v_t is null then return null; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'd', x.slot_date, 'n', x.n,
             'label', tgreport.dayname(x.slot_date) || ' ' || extract(day from x.slot_date)::int || ' ' || left(tgreport.monthname(x.slot_date), 3))
           order by x.slot_date)
    from (
      select ts.slot_date, count(*)::int n
      from public.therapist_slots ts
      where ts.therapist_id = v_t and ts.is_available
        and ts.slot_date between v_today and v_today + 14
        and ((ts.slot_date + ts.slot_end_time) at time zone 'Asia/Makassar') > now()
      group by ts.slot_date
    ) x
  ), '[]'::jsonb);
end
$fn$;

-- Slot owner pada satu tanggal, urut jam; booked = ada pasien aktif di slot itu.
create or replace function public.tg_izin_slots(p_date date) returns jsonb
language plpgsql stable security definer set search_path = public, tgreport as $fn$
declare
  v_t uuid := tgreport.izin_therapist();
begin
  if v_t is null then return null; end if;
  return jsonb_build_object(
    'label', tgreport.dayname(p_date) || ', ' || extract(day from p_date)::int || ' ' ||
             tgreport.monthname(p_date) || ' ' || extract(year from p_date)::int,
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object(
               'st', to_char(ts.slot_start_time, 'HH24:MI'),
               'en', to_char(ts.slot_end_time, 'HH24:MI'),
               'booked', exists (
                 select 1 from public.appointments a
                 where a.therapist_id = ts.therapist_id
                   and (a.appointment_date at time zone 'Asia/Makassar')::date = p_date
                   and (a.appointment_date at time zone 'Asia/Makassar')::time >= ts.slot_start_time
                   and (a.appointment_date at time zone 'Asia/Makassar')::time < ts.slot_end_time
                   and a.status in ('confirmed', 'pending', 'scheduled', 'rescheduled', 'ongoing')))
             order by ts.slot_start_time)
      from public.therapist_slots ts
      where ts.therapist_id = v_t and ts.slot_date = p_date and ts.is_available
        and ((ts.slot_date + ts.slot_end_time) at time zone 'Asia/Makassar') > now()
    ), '[]'::jsonb));
end
$fn$;

-- Terapkan izin untuk jam mulai terpilih (format HH:MI). Mengembalikan teks hasil.
create or replace function public.tg_izin_apply(p_date date, p_starts text[]) returns text
language plpgsql security definer set search_path = public, tgreport as $fn$
declare
  v_t uuid := tgreport.izin_therapist();
  v_owner uuid;
  v_total int;
  r record;
  v_n int := 0;
  v_lines text[] := '{}';
  v_booked text[] := '{}';
  v_all boolean;
  v_hdr text;
  p record;
begin
  if v_t is null then return '⚠️ Gagal: profil terapis owner tidak ditemukan.'; end if;
  if p_starts is null or cardinality(p_starts) = 0 then return '⚠️ Tidak ada jadwal yang dipilih.'; end if;

  select u.id into v_owner from public.users u
  where u.clinic_id = tgreport.clinic_id() and u.role = 'owner' and coalesce(u.is_active, true)
  order by u.created_at limit 1;

  v_hdr := tgreport.dayname(p_date) || ', ' || extract(day from p_date)::int || ' ' ||
           tgreport.monthname(p_date) || ' ' || extract(year from p_date)::int;

  select count(*) into v_total from public.therapist_slots ts
  where ts.therapist_id = v_t and ts.slot_date = p_date and ts.is_available
    and ((ts.slot_date + ts.slot_end_time) at time zone 'Asia/Makassar') > now();

  create temp table if not exists _izin_sel (st time, en time) on commit drop;
  truncate _izin_sel;
  insert into _izin_sel
  select ts.slot_start_time, ts.slot_end_time
  from public.therapist_slots ts
  where ts.therapist_id = v_t and ts.slot_date = p_date and ts.is_available
    and to_char(ts.slot_start_time, 'HH24:MI') = any (p_starts)
    and ((ts.slot_date + ts.slot_end_time) at time zone 'Asia/Makassar') > now();

  select count(*) into v_n from _izin_sel;
  if v_n = 0 then
    return 'ℹ️ Jadwal yang dipilih sudah tidak tersedia (mungkin sudah dikosongkan).' || E'\n' || v_hdr;
  end if;

  -- Catat pasien yang sudah terjadwal di slot terpilih sebelum slot dibuat ulang.
  for p in
    select to_char(s.st, 'HH24.MI') jam, coalesce(pt.full_name, 'pasien') nm
    from _izin_sel s
    join public.appointments a on a.therapist_id = v_t
      and (a.appointment_date at time zone 'Asia/Makassar')::date = p_date
      and (a.appointment_date at time zone 'Asia/Makassar')::time >= s.st
      and (a.appointment_date at time zone 'Asia/Makassar')::time < s.en
      and a.status in ('confirmed', 'pending', 'scheduled', 'rescheduled', 'ongoing')
    left join public.patients pt on pt.id = a.patient_id
    order by s.st
  loop
    v_booked := v_booked || (p.jam || ' ' || p.nm);
  end loop;

  v_all := (v_n = v_total);
  if v_all then
    insert into public.therapist_time_off (therapist_id, start_date, end_date, start_time, end_time, reason, leave_type, created_by)
    values (v_t, p_date, p_date, null, null, 'Izin Pribadi - via Telegram', 'personal', v_owner);
  else
    insert into public.therapist_time_off (therapist_id, start_date, end_date, start_time, end_time, reason, leave_type, created_by)
    select v_t, p_date, p_date, s.st, s.en, 'Izin Pribadi - via Telegram', 'personal', v_owner
    from _izin_sel s order by s.st;
  end if;

  for r in select to_char(st, 'HH24.MI') || '-' || to_char(en, 'HH24.MI') as jam from _izin_sel order by st loop
    v_lines := v_lines || r.jam;
  end loop;

  return '✅ Izin tercatat' || E'\n' || v_hdr || E'\n' ||
         case when v_all then 'Seharian (semua jadwal dikosongkan)' else 'Jam: ' || array_to_string(v_lines, ', ') end ||
         case when cardinality(v_booked) > 0
              then E'\n\n⚠️ Sudah ada pasien di jam ini, mohon dijadwal ulang:\n- ' || array_to_string(v_booked, E'\n- ')
              else '' end;
end
$fn$;

revoke all on function tgreport.izin_therapist() from public, anon, authenticated;
revoke all on function public.tg_izin_dates() from public, anon, authenticated;
revoke all on function public.tg_izin_slots(date) from public, anon, authenticated;
revoke all on function public.tg_izin_apply(date, text[]) from public, anon, authenticated;
grant execute on function public.tg_izin_dates() to service_role;
grant execute on function public.tg_izin_slots(date) to service_role;
grant execute on function public.tg_izin_apply(date, text[]) to service_role;
