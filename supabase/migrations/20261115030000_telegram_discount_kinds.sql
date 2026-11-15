-- Rincian jenis diskon di blok "Performa terapis" laporan malam Telegram.
--
-- Label diskon (daily_recaps.discount_label) dikelompokkan supaya ejaan yang
-- berbeda digabung: "Refferal reward" (salah ketik) = Referral reward,
-- "Event Rewards 50%" dan "Event Rewards Free" = Event. Label yang tidak
-- dikenal tampil apa adanya; label kosong menjadi "Lainnya".
--
-- Contoh keluaran:
--   Memakai diskon: 6 dari 13 sesi (potongan Rp280.000)
--   • Birthday: 2 sesi · Rp200.000
--   • Referral welcome: 4 sesi · Rp80.000

create or replace function tgreport.discount_kind(p_label text) returns text
language sql immutable as $fn$
  select case
    when coalesce(btrim(p_label), '') = '' then 'Lainnya'
    when lower(p_label) like 'referral welcome%' then 'Referral welcome'
    when lower(p_label) like 'ref%ral reward%' then 'Referral reward'
    when lower(p_label) like 'birthday%' then 'Birthday'
    when lower(p_label) like 'student%' then 'Student'
    when lower(p_label) like 'couple%' then 'Couple'
    when lower(p_label) like 'keluarga%' then 'Keluarga'
    when lower(p_label) like 'diskon owner%' then 'Owner'
    when lower(p_label) like 'event%' then 'Event'
    else btrim(p_label)
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
  if position('v_disc_list' in def) > 0 then
    return;
  end if;

  old := $a$  v_disc_n int; v_disc_amt numeric;$a$;
  new := $a$  v_disc_n int; v_disc_amt numeric; v_disc_list text;$a$;
  if position(old in def) = 0 then raise exception 'jangkar 1 tidak ditemukan'; end if;
  def := replace(def, old, new);

  old := $a$  i := 0;
  for r in select * from tgreport.ther_rows(d) order by t_s desc, t_rev desc, t_nm loop$a$;
  new := $a$  select string_agg('• ' || jenis || ': ' || n || ' sesi · ' || tgreport.rp(pot), E'\n' order by n desc, jenis)
    into v_disc_list
  from (
    select tgreport.discount_kind(discount_label) as jenis,
           count(*) as n,
           coalesce(sum(amount_original - amount)
                    filter (where coalesce(amount_original, 0) > coalesce(amount, 0)), 0) as pot
    from public.daily_recaps
    where clinic_id = c and recap_date = d and status is distinct from 'cancelled'
      and (coalesce(discount_value, 0) > 0 or coalesce(amount_original, 0) > coalesce(amount, 0))
    group by 1
  ) kinds;

  i := 0;
  for r in select * from tgreport.ther_rows(d) order by t_s desc, t_rev desc, t_nm loop$a$;
  if position(old in def) = 0 then raise exception 'jangkar 2 tidak ditemukan'; end if;
  def := replace(def, old, new);

  old := $a$' sesi (potongan ' || tgreport.rp(v_disc_amt) || ')'$a$;
  new := $a$' sesi (potongan ' || tgreport.rp(v_disc_amt) || ')' || coalesce(E'\n' || v_disc_list, '')$a$;
  if position(old in def) = 0 then raise exception 'jangkar 3 tidak ditemukan'; end if;
  def := replace(def, old, new);

  execute def;
end
$do$;

revoke all on all functions in schema tgreport from public, anon, authenticated;
