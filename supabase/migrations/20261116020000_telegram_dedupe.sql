-- Guard anti-dobel untuk pesan Telegram.
--
-- Penyebab dobel: soap_first_notify() mengirim push owner lewat DUA jalur
-- untuk satu kejadian: (1) INSERT ke notifications -> trg_push_notification
-- -> send-push-notification, dan (2) soap_first_push() -> send-push-notification
-- langsung. Keduanya tiba dalam ~40 ms, sehingga salinan Telegram ikut dobel.
--
-- Guard: send-telegram memanggil tg_dedupe_claim(hash teks, jendela detik)
-- sebelum mengirim. Fungsi ini atomik (INSERT ... ON CONFLICT pada kunci
-- primer), jadi dua permintaan serentak dengan teks yang sama hanya meloloskan
-- satu. Teks yang sama diizinkan lagi setelah jendela lewat. Kolom hits
-- mencatat berapa kali duplikat ditahan.
--
-- Tabel hanya bisa diakses service_role (RLS aktif tanpa policy).

create table if not exists public.telegram_dedupe (
  key      text primary key,
  first_at timestamptz not null default now(),
  last_at  timestamptz not null default now(),
  hits     int not null default 1,
  sample   text
);

alter table public.telegram_dedupe enable row level security;

create or replace function public.tg_dedupe_claim(p_key text, p_window_seconds int, p_sample text default null)
returns boolean
language plpgsql security definer set search_path = public as $fn$
declare
  v_hits int;
begin
  delete from public.telegram_dedupe where last_at < now() - interval '1 day';

  insert into public.telegram_dedupe as d (key, sample)
  values (p_key, left(p_sample, 200))
  on conflict (key) do update
    set hits     = case when d.first_at < now() - make_interval(secs => p_window_seconds) then 1 else d.hits + 1 end,
        first_at = case when d.first_at < now() - make_interval(secs => p_window_seconds) then now() else d.first_at end,
        last_at  = now()
  returning d.hits into v_hits;

  return v_hits = 1;
end
$fn$;

revoke all on function public.tg_dedupe_claim(text, int, text) from public, anon, authenticated;
grant execute on function public.tg_dedupe_claim(text, int, text) to service_role;
