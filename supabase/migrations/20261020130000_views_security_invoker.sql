-- 10 view tadinya SECURITY DEFINER sehingga melewati RLS: user klinik mana pun
-- yang login bisa membaca pasien/rekap/paket SEMUA klinik lewat view ini.
-- security_invoker membuat view mengikuti RLS pemanggil.
-- Diverifikasi: jumlah baris tiap klinik = jumlah baris tabel aslinya; super_admin
-- tetap melihat semua. Rollback per view:
--   ALTER VIEW public.<nama_view> SET (security_invoker = false);
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
