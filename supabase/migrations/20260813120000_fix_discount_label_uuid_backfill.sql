-- Fix historical daily_recaps rows where discount_label was mistakenly
-- saved as the operational_options row id (uuid) instead of its label
-- text — caused by a bug in DailyRecapModal.jsx's "Jenis Diskon" picker
-- (fixed in the same PR as this migration) where a stale/filtered
-- options list during search could fail to resolve the clicked option,
-- falling back to the raw id.
UPDATE daily_recaps dr
SET discount_label = oo.label
FROM operational_options oo
WHERE oo.category = 'discount_type'
  AND dr.discount_label ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND dr.discount_label = oo.id::text;
