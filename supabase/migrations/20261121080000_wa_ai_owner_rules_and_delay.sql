-- Jeda minimal menjawab (bisa diubah owner lewat Telegram) dan aturan umum owner.
alter table public.wa_ai_settings add column if not exists min_delay_seconds integer not null default 120;
comment on column public.wa_ai_settings.min_delay_seconds is 'Jeda minimal (detik) sebelum AI menyusun/mengirim balasan, di semua mode. Bisa diubah owner lewat Telegram (/jeda).';
alter table public.wa_ai_corrections drop constraint if exists wa_ai_corrections_kind_check;
alter table public.wa_ai_corrections add constraint wa_ai_corrections_kind_check check (kind in ('correction','approved','rule'));
alter table public.wa_ai_corrections add column if not exists deleted_at timestamptz;
