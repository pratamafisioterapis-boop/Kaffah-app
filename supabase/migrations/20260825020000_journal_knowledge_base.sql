-- Basis pengetahuan jurnal/ebook fisioterapi untuk fitur "Saran Klinis AI".
-- Owner mengunggah jurnal/ebook (PDF, boleh bahasa Indonesia atau Inggris),
-- teksnya dipecah jadi potongan (chunks) dan disimpan sebagai embedding
-- (pgvector) supaya bisa dicari secara semantik saat terapis mengisi SOAP.
-- Jawaban AI SELALU disintesis hanya dari potongan yang ditemukan di sini
-- (retrieval-augmented) — bukan dari pengetahuan bebas model — supaya
-- sitasi yang ditampilkan ke terapis selalu bisa ditelusuri ke dokumen asli.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE journal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  title text NOT NULL,
  author text,
  publication_year int,
  source_language text NOT NULL DEFAULT 'en' CHECK (source_language IN ('id', 'en')),
  topic_tags text[] NOT NULL DEFAULT '{}',
  file_path text NOT NULL,
  file_name text NOT NULL,
  page_count int,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
  error_message text,
  uploaded_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_documents_clinic ON journal_documents(clinic_id);

-- voyage-multilingual-2 -> 1024 dimensi, dipilih supaya query Bahasa
-- Indonesia dari terapis tetap bisa cocok secara semantik dengan potongan
-- jurnal berbahasa Inggris tanpa langkah terjemahan terpisah.
CREATE TABLE journal_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES journal_documents(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  page_number int,
  content text NOT NULL,
  embedding vector(1024) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_chunks_document ON journal_chunks(document_id);
CREATE INDEX idx_journal_chunks_clinic ON journal_chunks(clinic_id);
CREATE INDEX idx_journal_chunks_embedding ON journal_chunks
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE journal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_chunks ENABLE ROW LEVEL SECURITY;

-- Hanya owner/admin klinik yang boleh mengelola (upload/hapus) dokumen —
-- ini yang jadi sumber kebenaran saran klinis, jadi kurasinya dijaga ketat.
CREATE POLICY journal_documents_owner_manage ON journal_documents
  FOR ALL
  USING (
    clinic_id IN (
      SELECT users.clinic_id FROM users
      WHERE users.id = auth.uid() AND users.role = ANY (ARRAY['owner', 'admin', 'super_admin'])
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT users.clinic_id FROM users
      WHERE users.id = auth.uid() AND users.role = ANY (ARRAY['owner', 'admin', 'super_admin'])
    )
  );

-- Terapis boleh melihat daftar dokumen yang sudah siap (untuk transparansi
-- sumber referensi), tapi tidak boleh mengunggah/menghapus.
CREATE POLICY journal_documents_therapist_read ON journal_documents
  FOR SELECT
  USING (
    status = 'ready'
    AND clinic_id IN (
      SELECT users.clinic_id FROM users WHERE users.id = auth.uid()
    )
  );

-- journal_chunks tidak diakses langsung dari client (pencarian semantik
-- lewat RPC match_journal_chunks di edge function dengan service role) —
-- di sini hanya jaga-jaga: owner tetap boleh lihat mentahnya untuk audit.
CREATE POLICY journal_chunks_owner_manage ON journal_chunks
  FOR ALL
  USING (
    clinic_id IN (
      SELECT users.clinic_id FROM users
      WHERE users.id = auth.uid() AND users.role = ANY (ARRAY['owner', 'admin', 'super_admin'])
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT users.clinic_id FROM users
      WHERE users.id = auth.uid() AND users.role = ANY (ARRAY['owner', 'admin', 'super_admin'])
    )
  );

-- Bucket privat — file asli hanya diakses lewat service role di edge
-- function (untuk ekstraksi teks), tidak pernah lewat public URL.
INSERT INTO storage.buckets (id, name, public)
VALUES ('journal-documents', 'journal-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY journal_documents_storage_owner_manage ON storage.objects
  FOR ALL
  USING (bucket_id = 'journal-documents' AND get_my_role() = ANY (ARRAY['owner', 'admin', 'super_admin']))
  WITH CHECK (bucket_id = 'journal-documents' AND get_my_role() = ANY (ARRAY['owner', 'admin', 'super_admin']));

-- Pencarian semantik: dipanggil dari edge function (service role) dengan
-- clinic_id yang sudah diverifikasi dari JWT pemanggil, supaya hasil
-- pencarian tidak pernah bocor lintas klinik.
CREATE OR REPLACE FUNCTION match_journal_chunks(
  query_embedding vector(1024),
  p_clinic_id uuid,
  match_count int DEFAULT 6,
  min_similarity float DEFAULT 0.5
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
AS $$
  SELECT
    jc.id AS chunk_id,
    jc.document_id,
    jc.content,
    jc.page_number,
    jd.title,
    jd.author,
    jd.publication_year,
    1 - (jc.embedding <=> query_embedding) AS similarity
  FROM journal_chunks jc
  JOIN journal_documents jd ON jd.id = jc.document_id
  WHERE jc.clinic_id = p_clinic_id
    AND jd.status = 'ready'
    AND 1 - (jc.embedding <=> query_embedding) >= min_similarity
  ORDER BY jc.embedding <=> query_embedding
  LIMIT match_count;
$$;
