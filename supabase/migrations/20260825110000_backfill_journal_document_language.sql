-- Backfill source_language untuk jurnal/ebook yang sudah terlanjur
-- disimpan sebelum fitur auto-deteksi bahasa ada di form upload (owner
-- sebelumnya harus pilih manual dan defaultnya 'en', jadi banyak dokumen
-- berbahasa Indonesia yang salah tertandai 'en'). Deteksi dilakukan
-- dengan menghitung kemunculan stopword umum tiap bahasa (whole-word,
-- case-insensitive) atas gabungan seluruh chunk isi dokumen — sama
-- persis logikanya dengan detectJournalLanguage() di frontend
-- (src/lib/utils.js), supaya hasil backfill konsisten dengan deteksi
-- yang dipakai saat upload baru.
WITH doc_text AS (
  SELECT jd.id, string_agg(jc.content, ' ') AS full_text
  FROM journal_documents jd
  JOIN journal_chunks jc ON jc.document_id = jd.id
  GROUP BY jd.id
),
scores AS (
  SELECT
    id,
    (
      regexp_count(lower(full_text), '\myang\M') + regexp_count(lower(full_text), '\mdan\M') +
      regexp_count(lower(full_text), '\mdengan\M') + regexp_count(lower(full_text), '\mpada\M') +
      regexp_count(lower(full_text), '\madalah\M') + regexp_count(lower(full_text), '\mtidak\M') +
      regexp_count(lower(full_text), '\mdalam\M') + regexp_count(lower(full_text), '\muntuk\M') +
      regexp_count(lower(full_text), '\mdari\M') + regexp_count(lower(full_text), '\makan\M') +
      regexp_count(lower(full_text), '\matau\M') + regexp_count(lower(full_text), '\mini\M') +
      regexp_count(lower(full_text), '\mitu\M') + regexp_count(lower(full_text), '\mdapat\M') +
      regexp_count(lower(full_text), '\mjuga\M') + regexp_count(lower(full_text), '\mtersebut\M') +
      regexp_count(lower(full_text), '\mkepada\M') + regexp_count(lower(full_text), '\moleh\M') +
      regexp_count(lower(full_text), '\msebagai\M') + regexp_count(lower(full_text), '\mkarena\M')
    ) AS id_score,
    (
      regexp_count(lower(full_text), '\mthe\M') + regexp_count(lower(full_text), '\mand\M') +
      regexp_count(lower(full_text), '\mof\M') + regexp_count(lower(full_text), '\mto\M') +
      regexp_count(lower(full_text), '\min\M') + regexp_count(lower(full_text), '\mis\M') +
      regexp_count(lower(full_text), '\mthat\M') + regexp_count(lower(full_text), '\mfor\M') +
      regexp_count(lower(full_text), '\mon\M') + regexp_count(lower(full_text), '\mwith\M') +
      regexp_count(lower(full_text), '\mas\M') + regexp_count(lower(full_text), '\mare\M') +
      regexp_count(lower(full_text), '\mthis\M') + regexp_count(lower(full_text), '\mbe\M') +
      regexp_count(lower(full_text), '\mby\M') + regexp_count(lower(full_text), '\mwas\M') +
      regexp_count(lower(full_text), '\mwere\M') + regexp_count(lower(full_text), '\mfrom\M') +
      regexp_count(lower(full_text), '\mwhich\M') + regexp_count(lower(full_text), '\mtheir\M')
    ) AS en_score
  FROM doc_text
)
UPDATE journal_documents jd
SET source_language = CASE WHEN s.id_score >= s.en_score THEN 'id' ELSE 'en' END
FROM scores s
WHERE jd.id = s.id
  AND (s.id_score > 0 OR s.en_score > 0)
  AND jd.source_language IS DISTINCT FROM (CASE WHEN s.id_score >= s.en_score THEN 'id' ELSE 'en' END);
