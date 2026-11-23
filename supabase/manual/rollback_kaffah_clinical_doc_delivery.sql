-- Rollback migrasi 20261122230000 (pengiriman dokumen klinis Kaffah lewat template + tombol).
-- Aman dijalankan ulang. Menghapus tabel pelacakan (riwayat pengiriman dokumen ikut hilang).
-- Setelah rollback, kembalikan juga webhook wa-watzap-webhook dan klien ke versi sebelumnya.

SELECT cron.unschedule('clinical-doc-resolve')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'clinical-doc-resolve');

DROP FUNCTION IF EXISTS public.clinical_doc_on_button(uuid, text, text);
DROP FUNCTION IF EXISTS public.clinical_doc_resolve(uuid);
DROP FUNCTION IF EXISTS public.clinical_doc_send(text, uuid, text, text, text, date);
DROP FUNCTION IF EXISTS public.clinical_doc_resolve_pending();
DROP FUNCTION IF EXISTS public.clinical_doc_resolve_one(uuid);
DROP FUNCTION IF EXISTS public.clinical_doc_tanggal_id(date);
DROP FUNCTION IF EXISTS public.clinical_doc_caption(text);
DROP TABLE IF EXISTS public.clinical_doc_deliveries;
