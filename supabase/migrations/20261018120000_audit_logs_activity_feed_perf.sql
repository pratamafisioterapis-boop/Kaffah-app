-- Percepat feed lonceng notifikasi (DashboardTopbar) yang dimuat di semua menu.
-- Query: audit_logs WHERE clinic_id = ? AND resource_type = ? [AND action = ...]
--        ORDER BY created_at DESC LIMIT 50
-- Sebelumnya hanya ada index clinic_id, sehingga Postgres membaca ~108 ribu
-- baris klinik lalu menyortir, dan policy RLS dievaluasi di tiap baris
-- (11 detik per query). Query lambat ini ikut memperlambat semua menu lain.
CREATE INDEX IF NOT EXISTS idx_audit_logs_clinic_resource_created_at
  ON public.audit_logs (clinic_id, resource_type, created_at DESC);

-- get_my_role() hanya membaca public.users; tandai STABLE (sama seperti
-- get_my_clinic_id) supaya planner tidak memperlakukannya sebagai volatile
-- di ~90 policy RLS yang memakainya.
ALTER FUNCTION public.get_my_role() STABLE;

-- Bungkus fungsi auth dalam subquery agar dievaluasi sekali per query
-- (initplan), bukan sekali per baris.
ALTER POLICY clinic_isolated_audit_logs ON public.audit_logs
  USING (((SELECT public.get_my_role()) = 'super_admin'::text)
         OR (clinic_id = (SELECT public.get_my_clinic_id())));
