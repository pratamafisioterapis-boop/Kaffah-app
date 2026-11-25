-- Pemantau sisa kredit Claude API: peringatan Telegram saat sisa <= ambang (default 5 USD).
-- Anthropic tidak menyediakan API saldo, jadi saldo awal dicatat owner lewat Telegram (/kredit 25)
-- dan pemakaian sesudahnya dihitung dari Admin API cost_report oleh fungsi claude-credit-check.
CREATE TABLE IF NOT EXISTS public.claude_credit_monitor (
  id               int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  balance_usd      numeric,                       -- sisa kredit saat dicatat
  balance_as_of    timestamptz,                   -- kapan saldo dicatat
  spent_offset_usd numeric NOT NULL DEFAULT 0,    -- biaya hari UTC itu yang sudah terpakai sebelum saldo dicatat
  threshold_usd    numeric NOT NULL DEFAULT 5,
  last_alert_at    timestamptz,
  last_remaining   numeric,
  last_checked_at  timestamptz
);
INSERT INTO public.claude_credit_monitor (id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE public.claude_credit_monitor ENABLE ROW LEVEL SECURITY;

-- Cek tiap jam. Kunci internal diambil dari Vault (sama dengan laporan malam Telegram).
SELECT cron.schedule('claude-credit-check', '7 * * * *', $cron$
  select net.http_post(
    url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/claude-credit-check',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_internal_secret' limit 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$cron$);
