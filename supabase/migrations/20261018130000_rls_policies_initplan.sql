-- Percepat RLS: bungkus pemanggilan auth.uid()/auth.role()/auth.jwt()/
-- auth.email()/current_setting()/get_my_role()/get_my_clinic_id() dalam
-- (SELECT ...) supaya Postgres mengevaluasinya sekali per query (initplan),
-- bukan sekali per baris. Hanya USING/WITH CHECK yang diubah lewat
-- ALTER POLICY; nama, perintah, dan role policy tetap sama.
-- Panggilan yang sudah dibungkus "SELECT fn()" dilewati, jadi aman diulang.
DO $fn$
DECLARE
  r record;
  pat constant text := '(?<!SELECT )\m(auth\.(uid|role|jwt|email)\(\)|get_my_role\(\)|get_my_clinic_id\(\)|current_setting\([^()]*\))';
  new_q text;
  new_w text;
  stmt text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    new_q := regexp_replace(r.qual, pat, '(SELECT \1)', 'g');
    new_w := regexp_replace(r.with_check, pat, '(SELECT \1)', 'g');
    IF new_q IS NOT DISTINCT FROM r.qual AND new_w IS NOT DISTINCT FROM r.with_check THEN
      CONTINUE;
    END IF;
    stmt := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF new_q IS NOT NULL THEN stmt := stmt || format(' USING (%s)', new_q); END IF;
    IF new_w IS NOT NULL THEN stmt := stmt || format(' WITH CHECK (%s)', new_w); END IF;
    EXECUTE stmt;
  END LOOP;
END
$fn$;
