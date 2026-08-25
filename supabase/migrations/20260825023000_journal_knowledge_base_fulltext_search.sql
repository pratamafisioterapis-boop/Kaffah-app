-- Ganti pendekatan RAG dari embedding berbayar (Voyage AI) ke full-text
-- search bawaan PostgreSQL — gratis, tanpa API key tambahan. Owner juga
-- tidak perlu upload PDF lagi, cukup copy-paste isi jurnal, jadi kolom
-- file_path/file_name jadi opsional.

-- Bersihkan data uji coba lama yang statusnya 'failed' (gagal di tahap
-- embedding Voyage sebelum fitur ini diganti).
DELETE FROM journal_documents WHERE status = 'failed';

ALTER TABLE journal_documents
  ALTER COLUMN file_path DROP NOT NULL,
  ALTER COLUMN file_name DROP NOT NULL;

DROP FUNCTION IF EXISTS match_journal_chunks(vector, uuid, int, float);

DROP INDEX IF EXISTS idx_journal_chunks_embedding;
ALTER TABLE journal_chunks DROP COLUMN IF EXISTS embedding;

ALTER TABLE journal_chunks
  ADD COLUMN content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;

CREATE INDEX idx_journal_chunks_content_tsv ON journal_chunks USING gin (content_tsv);

-- Pencarian full-text: dipanggil dari edge function (service role) dengan
-- clinic_id yang sudah diverifikasi dari JWT pemanggil, sama seperti
-- fungsi lama, supaya hasil pencarian tidak pernah bocor lintas klinik.
-- websearch_to_tsquery dipakai karena toleran terhadap input bebas
-- (paragraf SOAP), tidak akan error walau ada karakter aneh.
CREATE OR REPLACE FUNCTION match_journal_chunks_fts(
  query_text text,
  p_clinic_id uuid,
  match_count int DEFAULT 6
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
    AND jc.content_tsv @@ websearch_to_tsquery('simple', query_text)
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
