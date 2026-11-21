-- Nomor yang diabaikan AI (mis. nomor admin sendiri): tanpa balasan dan tanpa draf Telegram.
alter table public.wa_ai_settings add column if not exists ignored_phones text[] not null default '{}';
comment on column public.wa_ai_settings.ignored_phones is 'Nomor (format 62812...) yang diabaikan AI: tidak dibalas dan tidak dibuatkan draf Telegram (mis. nomor admin sendiri).';
