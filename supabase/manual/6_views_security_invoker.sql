-- LANGKAH LANJUTAN (opsional, uji dulu di branch/staging Supabase).
--
-- Migrasi 20261017090000 sudah mencabut akses anon ke 10 view SECURITY DEFINER.
-- Namun view tersebut masih berjalan dengan hak pembuatnya (melewati RLS), jadi
-- user login dari klinik A secara teori masih bisa membaca baris klinik B lewat
-- PostgREST. Memasang security_invoker membuat view mengikuti RLS user
-- pemanggil, tetapi bisa mengubah hasil kalau RLS tabel dasarnya lebih ketat
-- dari yang diasumsikan view (baris hilang / kosong).
--
-- Cara aman:
--   1. Buat branch Supabase (create_branch) atau jalankan di staging.
--   2. Jalankan file ini.
--   3. Login sebagai admin klinik, owner, dan terapis; cek halaman yang memakai
--      daily_recaps_with_labels (CenteredPatientTable) dan daftar pasien/paket.
--   4. Bandingkan jumlah baris sebelum/sesudah:
--        SELECT count(*) FROM public.daily_recaps_with_labels;
--   5. Jika ada yang hilang, perbaiki RLS tabel dasarnya atau kembalikan:
--        ALTER VIEW public.<nama_view> SET (security_invoker = false);

ALTER VIEW public.patients_view                         SET (security_invoker = true);
ALTER VIEW public.patients_master_view                  SET (security_invoker = true);
ALTER VIEW public.patients_view_with_completeness       SET (security_invoker = true);
ALTER VIEW public.daily_recaps_with_labels              SET (security_invoker = true);
ALTER VIEW public.daily_recaps_search_view              SET (security_invoker = true);
ALTER VIEW public.package_tracking_view                 SET (security_invoker = true);
ALTER VIEW public.package_tracking_frontend             SET (security_invoker = true);
ALTER VIEW public.owner_today_available_slots           SET (security_invoker = true);
ALTER VIEW public.owner_today_available_slots_with_name SET (security_invoker = true);
ALTER VIEW public.therapist_daily_status_base           SET (security_invoker = true);
