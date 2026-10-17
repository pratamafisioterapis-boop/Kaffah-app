-- Hapus klinik beserta seluruh data turunannya (khusus super admin).
-- Banyak tabel punya FK clinic_id tanpa ON DELETE CASCADE sehingga
-- DELETE langsung pada clinics ditolak. Fungsi ini menemukan tabel-tabel
-- tersebut dari katalog dan menghapusnya berulang sampai tidak ada lagi
-- yang terhalang FK antar-tabel, lalu menghapus kliniknya.
-- Baris users tidak dihapus: FK-nya SET NULL, akun tetap ada tanpa klinik.

CREATE OR REPLACE FUNCTION public.delete_clinic(p_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r record;
  v_pass int;
  v_blocked int := 0;
  v_last_error text;
BEGIN
  IF get_my_role() IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Hanya super admin yang dapat menghapus klinik' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clinics WHERE id = p_clinic_id) THEN
    RAISE EXCEPTION 'Klinik tidak ditemukan';
  END IF;

  FOR v_pass IN 1..10 LOOP
    v_blocked := 0;

    FOR r IN
      SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f'
        AND c.confrelid = 'public.clinics'::regclass
        AND c.confdeltype = 'a'
      ORDER BY 1
    LOOP
      BEGIN
        EXECUTE format('DELETE FROM %s WHERE %I = $1', r.tbl, r.col) USING p_clinic_id;
      EXCEPTION WHEN foreign_key_violation THEN
        v_blocked := v_blocked + 1;
        GET STACKED DIAGNOSTICS v_last_error = MESSAGE_TEXT;
      END;
    END LOOP;

    EXIT WHEN v_blocked = 0;
  END LOOP;

  IF v_blocked > 0 THEN
    RAISE EXCEPTION 'Gagal menghapus data klinik: %', v_last_error;
  END IF;

  DELETE FROM public.clinics WHERE id = p_clinic_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.delete_clinic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_clinic(uuid) TO authenticated;
