-- Laporan malam Telegram untuk owner Kaffah Physiotherapy (clinic_id dikunci).
--
-- Dua pesan (Keuangan, Operasional) dibuat di database oleh
-- tgreport.build_nightly_report(), lalu dikirim ke Edge Function send-telegram
-- oleh tgreport.send_nightly_report() dari pg_cron. Kunci internal diambil dari
-- Supabase Vault (nama: telegram_internal_secret), tidak ditulis di sini.
--
-- Skema tgreport tidak diekspos lewat API (PostgREST) dan semua fungsinya
-- dicabut dari public/anon/authenticated.
--
-- Definisi yang dipakai (sama dengan laporan WhatsApp harian yang sudah ada):
--  - omzet  : daily_recaps.amount per revenue_date, status <> 'cancelled'
--  - sesi   : daily_recaps per recap_date, status <> 'cancelled'
--  - target : hitungan kunjungan sama dengan get_therapist_target_progress
--             (kecuali sesi cancelled dan tanggal setelah hari laporan tidak dihitung)
-- Definisi baru:
--  - kapasitas slot: slot jadwal terapis AKTIF (jadwal aktif), tanpa duplikat
--    hari Minggu (day_of_week 0 dan 7), tanpa slot yang tertutup cuti
--  - BEP bulan: biaya tetap (clinic_fixed_costs) / (1 - rasio biaya variabel bulan lalu).
--    Biaya variabel bulan lalu = pengeluaran admin + owner yang bukan auto-fixed,
--    dikurangi pos biaya tetap manual (gaji pokok yang diposting lewat payroll)
--    supaya tidak terhitung dua kali.

create schema if not exists tgreport;
revoke all on schema tgreport from public;

create or replace function tgreport.clinic_id() returns uuid
language sql immutable as $fn$ select 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid $fn$;

create or replace function tgreport.rp(n numeric) returns text
language sql immutable as $fn$
  select 'Rp' || replace(to_char(round(coalesce(n, 0)), 'FM999,999,999,990'), ',', '.')
$fn$;

create or replace function tgreport.jt(n numeric) returns text
language sql immutable as $fn$
  select 'Rp' || replace(rtrim(rtrim(to_char(round(coalesce(n, 0) / 1000000.0, 2), 'FM9999990.00'), '0'), '.'), '.', ',') || ' jt'
$fn$;

create or replace function tgreport.rb(n numeric) returns text
language sql immutable as $fn$
  select 'Rp' || round(coalesce(n, 0) / 1000.0)::bigint::text || ' rb'
$fn$;

create or replace function tgreport.arrow(v numeric) returns text
language sql immutable as $fn$
  select case when v >= 0 then '▲ ' else '▼ ' end || replace(to_char(abs(round(v, 1)), 'FM990.0'), '.', ',') || '%'
$fn$;

create or replace function tgreport.dayname(d date) returns text
language sql immutable as $fn$
  select (array['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'])[extract(dow from d)::int + 1]
$fn$;

create or replace function tgreport.monthname(d date) returns text
language sql immutable as $fn$
  select (array['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'])[extract(month from d)::int]
$fn$;

-- Jumlah slot jadwal terapis aktif pada tanggal tertentu.
create or replace function tgreport.capacity(p_date date) returns int
language sql stable security definer set search_path = public, tgreport as $fn$
  select count(*)::int from (
    select distinct s.therapist_id, s.start_time
    from public.therapist_schedules s
    join public.physiotherapists p on p.id = s.therapist_id
    where s.clinic_id = tgreport.clinic_id()
      and s.is_active and p.is_active
      and (s.day_of_week = extract(dow from p_date)::int
           or (extract(dow from p_date) = 0 and s.day_of_week = 7))
      and not exists (
        select 1 from public.therapist_time_off o
        where o.therapist_id = s.therapist_id
          and p_date between o.start_date and o.end_date
          and (o.start_time is null or o.end_time is null
               or (s.start_time < o.end_time and s.end_time > o.start_time)))
  ) x
$fn$;

-- Baris per terapis: sesi hari ini dan capaian periode target.
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
                  or (extract(dow from p_date) = 0 and s.day_of_week = 7))),
         exists (select 1 from public.therapist_time_off o
                  where o.therapist_id = th.id and p_date between o.start_date and o.end_date)
  from ther th
  left join today td on td.therapist_id = th.id
  left join per on per.id = th.id
  where th.start_date is not null or coalesce(td.s, 0) > 0
$fn$;

-- Membuat dua pesan laporan untuk tanggal p_date (default: hari ini WITA).
create or replace function tgreport.build_nightly_report(p_date date default null)
returns text[]
language plpgsql stable security definer set search_path = public, tgreport as $fn$
declare
  c uuid := tgreport.clinic_id();
  d date := coalesce(p_date, (now() at time zone 'Asia/Makassar')::date);
  m_start date := date_trunc('month', d::timestamp)::date;
  lm_start date := (date_trunc('month', d::timestamp) - interval '1 month')::date;
  lm_end date := (date_trunc('month', d::timestamp)::date - 1);
  dim int := extract(day from (date_trunc('month', d::timestamp) + interval '1 month' - interval '1 day'))::int;
  hdr text;
  r record;
  i int;

  v_rev numeric; v_prev numeric; v_avg7 numeric; v_mtd numeric; v_sess int;
  v_exp numeric; v_exp_tx int; v_fixedpost numeric;
  v_fixed numeric; v_fixed_manual numeric;
  v_lm_rev numeric; v_lm_cost numeric; v_ratio numeric := 0;
  v_bep_m numeric; v_bep_d numeric; v_proj numeric;
  v_cap int; v_conf int; v_resch int; v_canc int;
  v_cap_n int; v_conf_n int; v_leave text;
  v_soap_open int; v_soap_total int; v_soap_names text;
  v_inv int;
  v_stok_n int; v_stok_list text;

  alerts text[] := '{}';
  ther_lines text[] := '{}';
  per_lines text[] := '{}';
  pace numeric; v_pday int; v_plen int;
  b_omzet text; b_exp text; b_bep text; b_util text; b_ther text; b_soap text; b_besok text; b_stok text; b_alert text;
begin
  hdr := tgreport.dayname(d) || ', ' || extract(day from d)::int || ' ' || tgreport.monthname(d) || ' ' || extract(year from d)::int;

  -- Omzet
  select coalesce(sum(amount) filter (where revenue_date = d), 0),
         coalesce(sum(amount) filter (where revenue_date = d - 1), 0),
         coalesce(sum(amount) filter (where revenue_date between d - 7 and d - 1), 0) / 7.0,
         coalesce(sum(amount) filter (where revenue_date between m_start and d), 0)
    into v_rev, v_prev, v_avg7, v_mtd
  from public.daily_recaps
  where clinic_id = c and status is distinct from 'cancelled'
    and revenue_date between least(d - 7, m_start) and d;

  select count(*) into v_sess from public.daily_recaps
  where clinic_id = c and recap_date = d and status is distinct from 'cancelled';

  b_omzet := '💰 OMZET' || E'\n' ||
    tgreport.rp(v_rev) || ' dari ' || v_sess || ' sesi' ||
    case when v_sess > 0 then ' (rata-rata ' || tgreport.rb(v_rev / v_sess) || '/sesi)' else '' end ||
    case when v_prev > 0 then E'\n' || tgreport.arrow((v_rev / v_prev - 1) * 100) || ' vs kemarin (' || tgreport.rp(v_prev) || ')' else '' end ||
    case when v_avg7 > 0 then E'\n' || tgreport.arrow((v_rev / v_avg7 - 1) * 100) || ' vs rata-rata 7 hari (' || tgreport.rp(v_avg7) || ')' else '' end;

  -- Pengeluaran (operasional; biaya tetap otomatis dan payroll dipisah)
  select coalesce(sum(a), 0), coalesce(sum(n), 0)::int into v_exp, v_exp_tx from (
    select amount as a, 1 as n from public.admin_expenses
     where clinic_id = c and transaction_date = d
    union all
    select amount, 1 from public.owner_expenditures
     where clinic_id = c and date = d
       and not coalesce(is_auto_fixed_cost, false) and payroll_record_id is null
  ) x;
  select coalesce(sum(amount), 0) into v_fixedpost from public.owner_expenditures
   where clinic_id = c and date = d
     and (coalesce(is_auto_fixed_cost, false) or payroll_record_id is not null);

  b_exp := '🧾 PENGELUARAN' || E'\n' ||
    case when v_exp_tx = 0 then 'Tidak ada pengeluaran operasional tercatat'
         else tgreport.rp(v_exp) || ' (' || v_exp_tx || ' transaksi)' || E'\n' ||
              'Sisa kotor ' || tgreport.rp(v_rev - v_exp) ||
              case when v_rev > 0 then ' (' || round((v_rev - v_exp) / v_rev * 100)::int || '% dari omzet)' else '' end
    end ||
    case when v_fixedpost > 0 then E'\n' || 'Biaya tetap dan payroll tercatat hari ini ' || tgreport.rp(v_fixedpost) || ' (tidak masuk sisa kotor)' else '' end;

  -- Break even point
  select coalesce(sum(amount), 0), coalesce(sum(amount) filter (where not coalesce(auto_post, false)), 0)
    into v_fixed, v_fixed_manual
  from public.clinic_fixed_costs where clinic_id = c;

  select coalesce(sum(amount), 0) into v_lm_rev from public.daily_recaps
   where clinic_id = c and status is distinct from 'cancelled' and revenue_date between lm_start and lm_end;
  select coalesce((select sum(amount) from public.admin_expenses
                    where clinic_id = c and transaction_date between lm_start and lm_end), 0)
       + coalesce((select sum(amount) from public.owner_expenditures
                    where clinic_id = c and date between lm_start and lm_end
                      and not coalesce(is_auto_fixed_cost, false)), 0)
    into v_lm_cost;

  if v_lm_rev > 0 then
    v_ratio := least(0.8, greatest(0, (v_lm_cost - v_fixed_manual) / v_lm_rev));
  end if;
  v_bep_m := v_fixed / (1 - v_ratio);
  v_bep_d := v_bep_m / dim;
  v_proj := v_mtd / greatest(extract(day from d), 1) * dim;

  b_bep := '⚖️ BREAK EVEN POINT' || E'\n' ||
    'Biaya tetap ' || tgreport.rp(v_fixed) || '/bulan + biaya variabel ≈ ' || round(v_ratio * 100)::int || '% omzet' || E'\n' ||
    'BEP bulan ≈ ' || tgreport.jt(v_bep_m) || ' (harian ' || tgreport.rb(v_bep_d) || ')' || E'\n' ||
    case when v_bep_d > 0 then 'Hari ini ' || replace(to_char(v_rev / v_bep_d, 'FM990.0'), '.', ',') || '× BEP harian' || E'\n' else '' end ||
    'Bulan berjalan ' || tgreport.jt(v_mtd) || ' = ' || round(v_mtd / nullif(v_bep_m, 0) * 100)::int || '% BEP bulan: ' ||
    case when v_mtd >= v_bep_m then 'sudah tercapai' else 'belum tercapai, kurang ' || tgreport.jt(v_bep_m - v_mtd) end || E'\n' ||
    'Proyeksi akhir bulan ≈ ' || tgreport.jt(v_proj) || ' (' || round(v_proj / nullif(v_bep_m, 0) * 100)::int || '% BEP)';

  -- Utilisasi slot
  v_cap := tgreport.capacity(d);
  select count(*) filter (where coalesce(status, '') not in ('cancelled', 'rescheduled')),
         count(*) filter (where status = 'rescheduled'),
         count(*) filter (where status = 'cancelled')
    into v_conf, v_resch, v_canc
  from public.appointments
  where clinic_id = c and (appointment_date at time zone 'Asia/Makassar')::date = d;

  b_util := '📅 UTILISASI SLOT' || E'\n' ||
    case when v_cap > 0
         then 'Terisi ' || v_sess || ' dari ' || v_cap || ' slot (' || round(v_sess::numeric / v_cap * 100)::int || '%) · ' || greatest(v_cap - v_sess, 0) || ' kosong'
         else 'Tidak ada slot terjadwal (' || v_sess || ' sesi tercatat)' end || E'\n' ||
    'Booking: ' || v_conf || ' terkonfirmasi · ' || v_resch || ' reschedule · ' || v_canc || ' batal';

  -- Performa terapis
  i := 0;
  for r in select * from tgreport.ther_rows(d) order by t_s desc, t_rev desc, t_nm loop
    i := i + 1;
    ther_lines := ther_lines || (
      i || '. ' || r.t_nm || ' · ' || r.t_s || ' sesi' ||
      case when r.t_s > 0 then ' · ' || tgreport.rp(r.t_rev) || ' (' || tgreport.rb(r.t_rev / r.t_s) || '/sesi)'
           when r.t_leave then ' (cuti)'
           when r.t_slots = 0 then ' (libur)'
           else '' end);
  end loop;
  for r in select * from tgreport.ther_rows(d) where t_target is not null order by t_per desc, t_nm loop
    pace := (d - r.t_pstart + 1)::numeric / (r.t_pend - r.t_pstart + 1);
    per_lines := per_lines || (
      r.t_nm || ' ' || r.t_per || '/' || r.t_target ||
      case when r.t_per < 0.8 * pace * r.t_target then ' ⚠️ di bawah pace' else '' end);
    v_pday := (d - r.t_pstart + 1);
    v_plen := (r.t_pend - r.t_pstart + 1);
  end loop;

  b_ther := '🧑‍⚕️ PERFORMA TERAPIS (hari ini)' || E'\n' ||
    case when array_length(ther_lines, 1) is null then 'Belum ada data terapis'
         else array_to_string(ther_lines, E'\n') end ||
    case when array_length(per_lines, 1) is not null
         then E'\n' || 'Capaian periode target (hari ke-' || v_pday || ' dari ' || v_plen || '):' || E'\n' || array_to_string(per_lines, ' · ')
         else '' end;

  -- SOAP
  select count(*) filter (where status = 'completed'),
         count(*) filter (where status = 'completed' and soap_completed_at is null)
    into v_soap_total, v_soap_open
  from public.daily_recaps where clinic_id = c and recap_date = d;

  select string_agg(nm || ' ' || n, ', ' order by n desc, nm) into v_soap_names from (
    select regexp_replace(split_part(btrim(coalesce(p.name, dr.therapist_name, '?')), ' ', 1), '[,.]+$', '') as nm,
           count(*) as n
    from public.daily_recaps dr
    left join public.physiotherapists p on p.id = dr.therapist_id
    where dr.clinic_id = c and dr.recap_date = d
      and dr.status = 'completed' and dr.soap_completed_at is null
    group by 1
  ) x;

  b_soap := '📝 SOAP' || E'\n' ||
    case when v_soap_open = 0
         then 'Terisi ' || v_soap_total || ' dari ' || v_soap_total || ' sesi, tidak ada yang tertunggak'
         else v_soap_open || ' dari ' || v_soap_total || ' sesi belum terisi: ' || v_soap_names end;

  -- Persiapan besok
  v_cap_n := tgreport.capacity(d + 1);
  select count(*) filter (where coalesce(status, '') not in ('cancelled', 'rescheduled'))
    into v_conf_n
  from public.appointments
  where clinic_id = c and (appointment_date at time zone 'Asia/Makassar')::date = d + 1;

  select string_agg(distinct nm, ', ' order by nm) into v_leave from (
    select regexp_replace(split_part(btrim(p.name), ' ', 1), '[,.]+$', '') as nm
    from public.therapist_time_off t
    join public.physiotherapists p on p.id = t.therapist_id
    where p.clinic_id = c and p.is_active and d + 1 between t.start_date and t.end_date
  ) x;

  b_besok := '🗓 BESOK, ' || upper(tgreport.dayname(d + 1)) || ' ' || extract(day from d + 1)::int || ' ' || upper(tgreport.monthname(d + 1)) || E'\n' ||
    v_conf_n || ' booking terkonfirmasi' || E'\n' ||
    case when v_cap_n > 0
         then 'Terisi ' || round(v_conf_n::numeric / v_cap_n * 100)::int || '% (' || v_conf_n || '/' || v_cap_n || ') · ' || greatest(v_cap_n - v_conf_n, 0) || ' slot kosong'
         else 'Tidak ada slot terjadwal' end || E'\n' ||
    case when v_leave is null then 'Tidak ada terapis cuti' else 'Cuti: ' || v_leave end;

  -- Stok menipis
  select count(*) into v_stok_n from public.inventory_items
   where clinic_id = c and is_active and coalesce(minimum_stock, 0) > 0 and current_stock <= minimum_stock;
  select string_agg(t, E'\n' order by rn) into v_stok_list from (
    select '• ' || item_name || ' ' || replace(trim_scale(current_stock)::text, '.', ',') || '/' ||
           replace(trim_scale(minimum_stock)::text, '.', ',') || coalesce(' ' || unit, '') as t,
           row_number() over (order by current_stock / minimum_stock, item_name) as rn
    from public.inventory_items
    where clinic_id = c and is_active and coalesce(minimum_stock, 0) > 0 and current_stock <= minimum_stock
  ) x where rn <= 8;

  b_stok := '🧴 STOK MENIPIS' || E'\n' ||
    case when v_stok_n = 0 then 'Semua stok di atas batas minimum'
         else v_stok_n || ' item di batas minimum atau kurang (stok/minimum):' || E'\n' || v_stok_list ||
              case when v_stok_n > 8 then E'\n' || '+' || (v_stok_n - 8) || ' item lainnya' else '' end
    end;

  -- Peringatan
  select count(*) into v_inv from public.daily_recaps
   where clinic_id = c and recap_date = d and status is distinct from 'cancelled'
     and coalesce(amount, 0) > 0 and coalesce(payment_method, '') <> 'Package'
     and coalesce(invoice_wa_status, '') not in ('terkirim', 'terkirim_manual')
     and invoice_skip_reason is null;

  if v_inv > 0 then alerts := alerts || (v_inv || ' invoice WA belum terkirim'); end if;
  if v_soap_open > 0 then alerts := alerts || (v_soap_open || ' SOAP belum terisi (' || v_soap_names || ')'); end if;
  if v_avg7 > 0 and v_rev < 0.7 * v_avg7 then
    alerts := alerts || ('Omzet ' || tgreport.rp(v_rev) || ', hanya ' || round(v_rev / v_avg7 * 100)::int || '% dari rata-rata 7 hari');
  end if;
  if v_cap > 0 and v_sess::numeric / v_cap < 0.4 then
    alerts := alerts || ('Utilisasi slot ' || round(v_sess::numeric / v_cap * 100)::int || '% (' || v_sess || ' dari ' || v_cap || ' slot)');
  end if;
  if v_canc >= 3 then alerts := alerts || (v_canc || ' booking dibatalkan hari ini'); end if;

  b_alert := case when array_length(alerts, 1) is null then null
                  else '⚠️ PERLU PERHATIAN' || E'\n• ' || array_to_string(alerts, E'\n• ') end;

  return array[
    concat_ws(E'\n\n', '🌙 Laporan Malam 1/2 · Keuangan' || E'\n' || hdr, b_alert, b_omzet, b_exp, b_bep),
    concat_ws(E'\n\n', '🌙 Laporan Malam 2/2 · Operasional' || E'\n' || hdr, b_util, b_ther, b_soap, b_besok, b_stok)
  ];
end
$fn$;

-- Membuat laporan lalu mengirimnya lewat Edge Function send-telegram.
-- Kalau pembuatan laporan gagal, yang terkirim adalah pemberitahuan galat.
create or replace function tgreport.send_nightly_report(p_date date default null)
returns bigint
language plpgsql security definer set search_path = public, tgreport as $fn$
declare
  v_secret text;
  v_msgs text[];
  v_id bigint;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'telegram_internal_secret' limit 1;
  if v_secret is null then
    raise exception 'Secret telegram_internal_secret belum ada di Vault';
  end if;

  begin
    v_msgs := tgreport.build_nightly_report(p_date);
  exception when others then
    v_msgs := array['⚠️ Laporan Malam gagal dibuat: ' || left(sqlerrm, 300)];
  end;

  select net.http_post(
    url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-telegram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_secret),
    body := jsonb_build_object('event', 'laporan_malam', 'clinic_id', tgreport.clinic_id(), 'texts', to_jsonb(v_msgs)),
    timeout_milliseconds := 30000
  ) into v_id;
  return v_id;
end
$fn$;

revoke all on all functions in schema tgreport from public, anon, authenticated;
