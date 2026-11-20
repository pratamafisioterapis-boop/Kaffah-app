-- Koreksi owner via Telegram dan skor harian AI WhatsApp.
alter table public.wa_ai_logs
  add column if not exists telegram_message_id bigint,
  add column if not exists admin_reply text,
  add column if not exists verdict text,
  add column if not exists verdict_note text,
  add column if not exists evaluated_at timestamptz;
create index if not exists wa_ai_logs_telegram_msg_idx on public.wa_ai_logs (telegram_message_id) where telegram_message_id is not null;

create table if not exists public.wa_ai_corrections (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  log_id uuid references public.wa_ai_logs(id) on delete set null,
  conversation_id uuid,
  patient_message text,
  ai_draft text,
  correction text,
  kind text not null default 'correction' check (kind in ('correction','approved')),
  created_at timestamptz not null default now()
);
create index if not exists wa_ai_corrections_clinic_idx on public.wa_ai_corrections (clinic_id, created_at desc);
alter table public.wa_ai_corrections enable row level security;
comment on table public.wa_ai_corrections is 'Koreksi/persetujuan owner atas draf AI WhatsApp, dikirim dengan membalas pesan draf di Telegram.';

-- Skor harian 21.40 WITA (13.40 UTC).
select cron.schedule('wa-ai-daily-score', '40 13 * * *', $cron$
  select net.http_post(
    url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/wa-ai-reply',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-token', (select token from public.wa_ai_cron_secret limit 1)),
    body := '{"daily_report": true}'::jsonb
  );
$cron$);
