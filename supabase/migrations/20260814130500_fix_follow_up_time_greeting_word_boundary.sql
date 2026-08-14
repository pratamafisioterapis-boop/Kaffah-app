-- The previous migration's regexp_replace used \b for a word boundary, but
-- Postgres's regex engine (POSIX ARE) doesn't treat \b as a word boundary —
-- that's \y — so \b matched nothing and the "follow_up" templates were left
-- with the hardcoded "Selamat pagi/Pagi" greeting. Redo it with \y.
UPDATE wa_templates
SET template_text = regexp_replace(template_text, '^Selamat\s+[Pp]agi\y', '[waktu]'),
    placeholders = CASE
      WHEN placeholders @> '["waktu"]'::jsonb THEN placeholders
      ELSE placeholders || '["waktu"]'::jsonb
    END,
    updated_at = timezone('utc'::text, now())
WHERE category = 'follow_up'
  AND template_text ~ '^Selamat\s+[Pp]agi\y';
