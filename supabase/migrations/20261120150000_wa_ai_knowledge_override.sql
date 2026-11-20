-- Knowledge AI disimpan juga di database agar bisa diperbarui tanpa deploy ulang fungsi.
-- Isi kolom ini dengan isi docs/AI_KNOWLEDGE_KAFFAH.md (lihat tools/sync-ai-knowledge.js --sql).
ALTER TABLE public.wa_ai_settings ADD COLUMN IF NOT EXISTS knowledge_override text;
COMMENT ON COLUMN public.wa_ai_settings.knowledge_override IS 'Knowledge AI terbaru (salinan docs/AI_KNOWLEDGE_KAFFAH.md). Bila kosong, fungsi memakai knowledge bawaan di kode.';
