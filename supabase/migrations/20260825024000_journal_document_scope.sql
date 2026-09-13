-- Tambah kategori peruntukan jurnal/ebook: selama ini semua dokumen di
-- "Basis Jurnal AI" dianggap satu kolam yang sama dan cuma dipakai fitur
-- "Saran Klinis AI" (saran tindakan/intervensi/latihan). Sekarang owner
-- bisa menandai jurnal untuk keperluan ASSESSMENT (bantu merumuskan
-- kemungkinan diagnosa, pemeriksaan spesifik, dan apa yang perlu
-- dievaluasi) supaya referensinya tidak tercampur dengan referensi
-- tindakan saat AI mencari potongan yang relevan.
ALTER TABLE journal_documents
  ADD COLUMN document_scope text NOT NULL DEFAULT 'both'
    CHECK (document_scope IN ('assessment', 'tindakan', 'both'));

COMMENT ON COLUMN journal_documents.document_scope IS
  'Peruntukan dokumen: assessment (bantu diagnosa/pemeriksaan), tindakan (saran intervensi/latihan), atau both (dipakai di kedua fitur). Dokumen lama default ke both supaya tidak hilang dari fitur yang sudah berjalan.';

-- Ganti fungsi pencarian supaya bisa difilter per peruntukan. Parameter
-- p_scope diberi default 'tindakan' supaya pemanggil lama (edge function
-- soap-clinical-advice sebelum migrasi ini di-deploy ulang) tetap jalan
-- tanpa error, walau idealnya tiap pemanggil selalu kirim scope eksplisit.
CREATE OR REPLACE FUNCTION match_journal_chunks_fts(
  query_text text,
  p_clinic_id uuid,
  match_count int DEFAULT 6,
  p_scope text DEFAULT 'tindakan'
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  content text,
  page_number int,
  title text,
  author text,
  publication_year int,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    jc.id AS chunk_id,
    jc.document_id,
    jc.content,
    jc.page_number,
    jd.title,
    jd.author,
    jd.publication_year,
    ts_rank(jc.content_tsv, websearch_to_tsquery('simple', query_text)) AS similarity
  FROM journal_chunks jc
  JOIN journal_documents jd ON jd.id = jc.document_id
  WHERE jc.clinic_id = p_clinic_id
    AND jd.status = 'ready'
    AND jd.document_scope IN (p_scope, 'both')
    AND jc.content_tsv @@ websearch_to_tsquery('simple', query_text)
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
