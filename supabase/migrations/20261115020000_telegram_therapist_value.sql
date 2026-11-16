-- Revisi blok "Performa terapis" di laporan malam Telegram.
--
-- 1) Nilai per sesi. Pada sesi paket, daily_recaps.amount = 0 (kecuali sesi
--    saat paket dibeli, yang berisi seluruh harga paket), sedangkan
--    daily_recaps.amount_package = harga paket / jumlah sesi (cocok dengan
--    package_tracking.nominal / total_sessions). Nilai sesi terapis sekarang:
--      sesi paket   -> amount_package (cadangan: nominal / total_sessions)
--      sesi reguler -> amount (setelah diskon)
--      sesi FREE    -> 0
-- 2) Label tidak hadir mengikuti jenis di therapist_time_off.leave_type:
--    weekly_off = libur, sick = sakit, annual = cuti, personal/other = izin.
-- 3) Jumlah sesi berdiskon per terapis dan total hari itu beserta potongannya.
--    Sesi berdiskon: discount_value > 0 atau amount_original > amount.

create or replace function tgreport.leave_label(p_type text) returns text
language sql immutable as $fn$
  select case p_type
           when 'weekly_off' then 'libur'
           when 'sick' then 'sakit'
           when 'annual' then 'cuti'
           else 'izin' end
$fn$;

drop function if exists tgreport.ther_rows(date);

create function tgreport.ther_rows(p_date date)
returns table(t_nm text, t_s int, t_rev numeric, t_per int, t_target int,
              t_pstart date, t_pend date, t_slots int, t_leave boolean,
              t_leave_type text, t_disc_n int, t_disc_amt numeric)
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
    select dr.therapist_id,
           count(*)::int as s,
           coalesce(sum(
             case when dr.package_tracking_id is not null
                  then coalesce(nullif(dr.amount_package, 0),
                                pt.nominal / nullif(pt.total_sessions, 0),
                                dr.amount, 0)
                  else coalesce(dr.amount, 0) end), 0) as rev,
           count(*) filter (where coalesce(dr.discount_value, 0) > 0
                              or coalesce(dr.amount_original, 0) > coalesce(dr.amount, 0))::int as disc_n,
           coalesce(sum(dr.amount_original - dr.amount)
                    filter (where coalesce(dr.amount_original, 0) > coalesce(dr.amount, 0)), 0) as disc_amt
    from public.daily_recaps dr
    left join public.package_tracking pt on pt.id = dr.package_tracking_id
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
                          where e.therapist_id = th.id and e.shift_date = p_date),
         (select o.leave_type from public.therapist_time_off o
           where o.therapist_id = th.id and p_date between o.start_date and o.end_date
           order by (o.leave_type = 'weekly_off'), o.created_at desc limit 1),
         coalesce(td.disc_n, 0), coalesce(td.disc_amt, 0)
  from ther th
  left join today td on td.therapist_id = th.id
  left join per on per.id = th.id
  where th.start_date is not null or coalesce(td.s, 0) > 0
$fn$;

-- Tambalan build_nightly_report (aman dijalankan ulang: dilewati bila sudah ditambal).
do $do$
declare
  def text;
  old text;
  new text;
begin
  select pg_get_functiondef('tgreport.build_nightly_report(date)'::regprocedure) into def;
  if position('v_disc_n' in def) > 0 then
    return;
  end if;

  old := $a$  v_stok_n int; v_stok_list text;$a$;
  new := $a$  v_stok_n int; v_stok_list text;
  v_disc_n int; v_disc_amt numeric;$a$;
  if position(old in def) = 0 then raise exception 'jangkar 1 tidak ditemukan'; end if;
  def := replace(def, old, new);

  old := $a$  i := 0;
  for r in select * from tgreport.ther_rows(d) order by t_s desc, t_rev desc, t_nm loop$a$;
  new := $a$  select count(*) filter (where coalesce(discount_value, 0) > 0
                                 or coalesce(amount_original, 0) > coalesce(amount, 0)),
         coalesce(sum(amount_original - amount)
                  filter (where coalesce(amount_original, 0) > coalesce(amount, 0)), 0)
    into v_disc_n, v_disc_amt
  from public.daily_recaps
  where clinic_id = c and recap_date = d and status is distinct from 'cancelled';

  i := 0;
  for r in select * from tgreport.ther_rows(d) order by t_s desc, t_rev desc, t_nm loop$a$;
  if position(old in def) = 0 then raise exception 'jangkar 2 tidak ditemukan'; end if;
  def := replace(def, old, new);

  old := $a$      case when r.t_s > 0 then ' · ' || tgreport.rp(r.t_rev) || ' (' || tgreport.rb(r.t_rev / r.t_s) || '/sesi)'
           when r.t_leave then ' (cuti)'$a$;
  new := $a$      case when r.t_s > 0 then ' · ' || tgreport.rp(r.t_rev) || ' (' || tgreport.rb(r.t_rev / r.t_s) || '/sesi)' ||
                case when r.t_disc_n > 0 then ' · ' || r.t_disc_n || ' diskon' else '' end
           when r.t_leave then ' (' || tgreport.leave_label(r.t_leave_type) || ')'$a$;
  if position(old in def) = 0 then raise exception 'jangkar 3 tidak ditemukan'; end if;
  def := replace(def, old, new);

  old := $a$         else array_to_string(ther_lines, E'\n') end ||$a$;
  new := $a$         else array_to_string(ther_lines, E'\n') end ||
    E'\n' || 'Nilai per sesi: sesi paket = harga paket ÷ jumlah sesi' ||
    case when v_disc_n > 0
         then E'\n' || 'Memakai diskon: ' || v_disc_n || ' dari ' || v_sess || ' sesi (potongan ' || tgreport.rp(v_disc_amt) || ')'
         else E'\n' || 'Tidak ada sesi berdiskon' end ||$a$;
  if position(old in def) = 0 then raise exception 'jangkar 4 tidak ditemukan'; end if;
  def := replace(def, old, new);

  old := $a$                then ' (' || to_char(t.start_time, 'HH24.MI') || '-' || to_char(t.end_time, 'HH24.MI') || ')'
                else '' end as nm$a$;
  new := $a$                then ' (' || tgreport.leave_label(t.leave_type) || ' ' || to_char(t.start_time, 'HH24.MI') || '-' || to_char(t.end_time, 'HH24.MI') || ')'
                else ' (' || tgreport.leave_label(t.leave_type) || ')' end as nm$a$;
  if position(old in def) = 0 then raise exception 'jangkar 5 tidak ditemukan'; end if;
  def := replace(def, old, new);

  execute def;
end
$do$;

revoke all on all functions in schema tgreport from public, anon, authenticated;
