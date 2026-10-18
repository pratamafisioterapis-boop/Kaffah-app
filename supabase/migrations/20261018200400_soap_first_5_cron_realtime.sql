-- SOAP-first (KHUSUS Kaffah) - tahap 5: penjadwal pengingat + realtime pengajuan.
-- (Trigger sudah disambungkan di tahap 3; di produksi tahap 3 dipasang dalam dua langkah:
--  fungsi dulu, trigger sesudah diuji.) Tanpa DROP.

CREATE OR REPLACE TRIGGER ab_soap_first_prepare
  BEFORE INSERT OR UPDATE ON public.daily_recaps
  FOR EACH ROW EXECUTE FUNCTION public.trg_ab_soap_first_prepare();

SELECT cron.schedule('soap-first-reminders', '* * * * *', 'select public.soap_first_send_reminders()');

ALTER PUBLICATION supabase_realtime ADD TABLE public.soap_overrides;

NOTIFY pgrst, 'reload schema';
