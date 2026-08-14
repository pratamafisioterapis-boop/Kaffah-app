-- The "Follow Up Rutin" template always opened with a hardcoded "Selamat
-- pagi", even though these items are queued at generation time (~07:00) but
-- sent manually by the admin whenever they get to it — often well into the
-- afternoon or evening. Switch to the [waktu] placeholder (already used by
-- the referral_reward template) so the greeting is resolved dynamically at
-- display/send time instead of being baked in as stale text.
UPDATE wa_templates
SET template_text = regexp_replace(template_text, '^Selamat\s+[Pp]agi\y', '[waktu]'),
    placeholders = CASE
      WHEN placeholders @> '["waktu"]'::jsonb THEN placeholders
      ELSE placeholders || '["waktu"]'::jsonb
    END,
    updated_at = timezone('utc'::text, now())
WHERE category = 'follow_up'
  AND template_text ~ '^Selamat\s+[Pp]agi\y';
