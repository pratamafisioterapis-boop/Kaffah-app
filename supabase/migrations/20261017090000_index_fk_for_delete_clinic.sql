-- delete_clinic kena statement timeout (role authenticated dibatasi 8 detik)
-- karena banyak kolom FK tanpa index: tiap baris yang dihapus memicu seq scan
-- pada tabel yang mereferensikannya (mis. operational_options.parent_id yang
-- self-reference, package_tracking.package_type_id, dst). Tambahkan index pada
-- semua FK satu-kolom yang mengarah ke tabel inti klinik dan belum punya index.

DO $fn$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass::text AS tbl,
           cl.relname AS relname,
           a.attname AS col
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid AND cl.relkind = 'r'
    JOIN pg_namespace n ON n.oid = cl.relnamespace AND n.nspname = 'public'
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND array_length(c.conkey, 1) = 1
      AND c.confrelid IN (
        'public.clinics'::regclass,
        'public.operational_options'::regclass,
        'public.patients'::regclass,
        'public.physiotherapists'::regclass,
        'public.appointments'::regclass,
        'public.daily_recaps'::regclass,
        'public.medical_records'::regclass
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]
      )
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %s (%I)',
      left('idx_fk_' || r.relname || '_' || r.col, 63), r.tbl, r.col
    );
  END LOOP;
END;
$fn$;
