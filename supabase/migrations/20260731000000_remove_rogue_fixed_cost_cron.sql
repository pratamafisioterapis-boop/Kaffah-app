-- A second, independent auto-posting mechanism was found running directly in
-- the database via pg_cron (job id 67, schedule '10 17 * * *' = 01:10 WIB),
-- calling public.post_monthly_fixed_costs() daily. This function duplicates
-- what the frontend's autoPostFixedCosts() (src/lib/api.js) already does, but
-- worse:
--   - it ignores clinic_fixed_costs.auto_post, so items meant to post only
--     via payroll (e.g. "gaji ...") get posted here too — a real double-post
--     risk for salaries
--   - it never updates clinic_fixed_costs.last_posted_month, so it has no
--     shared de-dupe state with the frontend's auto-poster
--   - it inserts owner_expenditures rows without is_auto_fixed_cost = true,
--     so getBepFinancials()'s dedupe filter doesn't catch them either —
--     these rows were being double-counted in BEP on top of the full
--     clinic_fixed_costs total
--
-- This function/job isn't defined anywhere in this migrations folder, so it
-- was created directly against the project outside of tracked history.
-- Confirmed with the owner (2026-07-31) that the frontend's own auto-post
-- flow is the intended single source of truth; this job is being retired.
--
-- Applied directly against the Supabase project via MCP apply_migration on
-- 2026-07-31.

select cron.unschedule(67);

drop function if exists public.post_monthly_fixed_costs();

-- Remove the duplicate rows it already inserted (category = 'Fixed Cost
-- Bulanan' is unique to this function — the frontend never writes that
-- literal string). Each of these duplicates an amount already accounted for
-- elsewhere (clinic_fixed_costs total, or upcoming payroll for salary items),
-- so deleting them removes double-counted rows, not real expenses.
delete from owner_expenditures
where category = 'Fixed Cost Bulanan';
