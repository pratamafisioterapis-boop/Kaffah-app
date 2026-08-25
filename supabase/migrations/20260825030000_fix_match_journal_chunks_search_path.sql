-- Kunci search_path fungsi match_journal_chunks (temuan advisor keamanan
-- Supabase: "role mutable search_path") supaya tidak bisa dibajak dengan
-- object bernama sama di schema lain yang lebih dulu di search_path.
ALTER FUNCTION match_journal_chunks(vector, uuid, int, float) SET search_path = public, pg_temp;
