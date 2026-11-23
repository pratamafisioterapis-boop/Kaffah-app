-- Isi waktu balasan admin (wa_ai_logs.admin_replied_at) tiap 20 menit pukul 08.00-22.59 WITA
-- (00.00-14.59 UTC) lewat fungsi wa-admin-reply-times supaya tab "Performa Admin" hampir real-time.
select cron.schedule('wa-admin-reply-times', '*/20 0-14 * * *', $cron$
  select net.http_post(
    url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/wa-admin-reply-times',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-token', (select token from public.wa_ai_cron_secret limit 1)),
    body := '{}'::jsonb
  );
$cron$);
