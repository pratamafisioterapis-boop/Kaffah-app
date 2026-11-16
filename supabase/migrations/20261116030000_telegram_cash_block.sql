-- Blok "Kas tunai admin" di laporan malam Telegram (pesan 1/2, Keuangan).
--
-- Memakai buku kas yang sudah ada di aplikasi (cash_ledger_config,
-- cash_handovers, daily_recaps.cashier_id, public.recap_cash_amount,
-- public._petty_summary) dengan rumus yang sama persis dengan
-- public.get_cash_holdings(), hanya saja menerima clinic_id sebagai parameter
-- karena get_cash_holdings() butuh login pengguna dan tidak bisa dipanggil
-- dari jadwal otomatis:
--   saldo per orang = kas diterima sebagai kasir (sejak start_date buku kas)
--                   + setoran masuk terkonfirmasi
--                   - setoran keluar (menunggu + terkonfirmasi, termasuk isi ulang kas kecil)
--
-- Contoh keluaran:
--   💵 KAS TUNAI ADMIN
--   Sila (pemegang kas): Rp0 · terima Rp225.000 · setor Rp1.825.000
--   Total cash di admin: Rp0 (semua sudah disetor)
--   Kas kecil: Rp300.000 (plafon Rp300.000)
--   Buku kas sejak 12 Nov

create or replace function tgreport.cash_holdings(p_clinic uuid, p_date date)
returns table(uid uuid, nm text, recv numeric, h_in numeric, h_out numeric, pending_in numeric,
              balance numeric, is_custodian boolean, recv_today numeric, in_today numeric, out_today numeric)
language plpgsql stable security definer set search_path = public, tgreport as $fn$
declare
  v_start date;
  v_cust uuid;
begin
  select c.start_date, c.custodian_user_id into v_start, v_cust
  from public.cash_ledger_config c where c.clinic_id = p_clinic;
  if v_start is null then
    return;
  end if;

  return query
  with recv as (
    select r.cashier_id as u,
           sum(public.recap_cash_amount(r)) as amt,
           sum(public.recap_cash_amount(r)) filter (where coalesce(r.revenue_date, r.recap_date) = p_date) as amt_today
    from public.daily_recaps r
    where r.clinic_id = p_clinic and coalesce(r.revenue_date, r.recap_date) >= v_start
    group by r.cashier_id
  ),
  h_in as (
    select h.to_user_id as u,
           sum(h.amount) filter (where h.status = 'confirmed') as confirmed,
           sum(h.amount) filter (where h.status = 'pending') as pending,
           sum(h.amount) filter (where h.status = 'confirmed' and h.handover_date = p_date) as in_today
    from public.cash_handovers h
    where h.clinic_id = p_clinic and h.to_type = 'admin'
    group by h.to_user_id
  ),
  h_out as (
    select h.from_user_id as u,
           sum(h.amount + h.petty_replenish) filter (where h.status in ('pending', 'confirmed')) as total_out,
           sum(h.amount + h.petty_replenish) filter (where h.status in ('pending', 'confirmed') and h.handover_date = p_date) as out_today
    from public.cash_handovers h
    where h.clinic_id = p_clinic
    group by h.from_user_id
  ),
  ids as (
    select u from recv union select u from h_in union select u from h_out
    union select us.id from public.users us
          where us.clinic_id = p_clinic and us.role = 'admin' and coalesce(us.is_active, true)
  )
  select i.u,
         us.full_name,
         coalesce(rv.amt, 0),
         coalesce(hi.confirmed, 0),
         coalesce(ho.total_out, 0),
         coalesce(hi.pending, 0),
         coalesce(rv.amt, 0) + coalesce(hi.confirmed, 0) - coalesce(ho.total_out, 0),
         (i.u is not null and i.u = v_cust),
         coalesce(rv.amt_today, 0),
         coalesce(hi.in_today, 0),
         coalesce(ho.out_today, 0)
  from ids i
  left join public.users us on us.id = i.u
  left join recv rv on rv.u is not distinct from i.u
  left join h_in hi on hi.u = i.u
  left join h_out ho on ho.u = i.u;
end
$fn$;

-- Teks blok kas; null bila buku kas klinik belum diaktifkan.
create or replace function tgreport.cash_block(p_date date) returns text
language plpgsql stable security definer set search_path = public, tgreport as $fn$
declare
  c uuid := tgreport.clinic_id();
  v_start date;
  r record;
  p record;
  lines text[] := '{}';
  v_total numeric := 0;
  v_pending numeric := 0;
  v_recv_today numeric := 0;
  v_out_today numeric := 0;
  v_txt text;
begin
  select start_date into v_start from public.cash_ledger_config where clinic_id = c;
  if v_start is null then
    return null;
  end if;

  for r in
    select * from tgreport.cash_holdings(c, p_date) h
    order by h.is_custodian desc, h.balance desc, h.nm nulls last
  loop
    v_total := v_total + r.balance;
    v_pending := v_pending + r.pending_in;
    v_recv_today := v_recv_today + r.recv_today;
    v_out_today := v_out_today + r.out_today;

    -- Tampilkan orang yang memegang kas, pemegang kas, atau bergerak hari ini.
    if r.balance <> 0 or r.is_custodian or r.recv_today <> 0 or r.in_today <> 0 or r.out_today <> 0 then
      lines := lines || (
        coalesce(regexp_replace(split_part(btrim(r.nm), ' ', 1), '[,.]+$', ''), 'Tanpa kasir') ||
        case when r.is_custodian then ' (pemegang kas)' else '' end || ': ' || tgreport.rp(r.balance) ||
        case when r.recv_today <> 0 then ' · terima ' || tgreport.rp(r.recv_today) else '' end ||
        case when r.in_today <> 0 then ' · dapat setoran ' || tgreport.rp(r.in_today) else '' end ||
        case when r.out_today <> 0 then ' · setor ' || tgreport.rp(r.out_today) else '' end);
    end if;
  end loop;

  v_txt := '💵 KAS TUNAI ADMIN' || E'\n' ||
    case when array_length(lines, 1) is null then 'Belum ada pergerakan kas' else array_to_string(lines, E'\n') end || E'\n' ||
    'Total cash di admin: ' || tgreport.rp(v_total) ||
    case when v_total = 0 then ' (semua sudah disetor)' else '' end ||
    case when v_pending > 0 then E'\n' || 'Setoran menunggu konfirmasi: ' || tgreport.rp(v_pending) else '' end;

  select * into p from public._petty_summary(c);
  if found then
    v_txt := v_txt || E'\n' || 'Kas kecil: ' || tgreport.rp(p.balance) || ' (plafon ' || tgreport.rp(p.plafon) ||
             case when p.needed > 0 then ', perlu isi ulang ' || tgreport.rp(p.needed) else '' end || ')';
  end if;

  return v_txt || E'\n' || 'Buku kas sejak ' || extract(day from v_start)::int || ' ' || tgreport.monthname(v_start);
end
$fn$;

revoke all on function tgreport.cash_holdings(uuid, date) from public, anon, authenticated;
revoke all on function tgreport.cash_block(date) from public, anon, authenticated;

-- Tambalan build_nightly_report (aman dijalankan ulang: dilewati bila sudah ditambal).
do $do$
declare
  def text;
  old text;
  new text;
begin
  select pg_get_functiondef('tgreport.build_nightly_report(date)'::regprocedure) into def;
  if position('b_kas' in def) > 0 then
    return;
  end if;

  old := $a$b_stok text; b_alert text;$a$;
  new := $a$b_stok text; b_alert text; b_kas text;$a$;
  if position(old in def) = 0 then raise exception 'jangkar 1 tidak ditemukan'; end if;
  def := replace(def, old, new);

  old := $a$  return array[$a$;
  new := $a$  b_kas := tgreport.cash_block(d);

  return array[$a$;
  if position(old in def) = 0 then raise exception 'jangkar 2 tidak ditemukan'; end if;
  def := replace(def, old, new);

  old := $a$b_exp, b_bep),$a$;
  new := $a$b_exp, b_bep, b_kas),$a$;
  if position(old in def) = 0 then raise exception 'jangkar 3 tidak ditemukan'; end if;
  def := replace(def, old, new);

  execute def;
end
$do$;

revoke all on all functions in schema tgreport from public, anon, authenticated;
