-- Penanda draf AI yang sudah dibandingkan dengan balasan admin asli (pembelajaran knowledge).
alter table public.wa_ai_logs add column if not exists learned_at timestamptz;
comment on column public.wa_ai_logs.learned_at is 'Kapan draf ini sudah dibandingkan dengan balasan admin asli untuk pembelajaran knowledge.';
