-- Kolom progres numerik supaya owner bisa lihat persentase saat dokumen
-- jurnal sedang diekstrak+di-embed (bukan cuma status processing/ready/failed
-- yang tidak menunjukkan seberapa jauh prosesnya).
ALTER TABLE journal_documents
  ADD COLUMN progress_percent int NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100);
