-- USULAN, BELUM DITERAPKAN. Pengetatan hasil review keamanan portal pasien Clinara
-- (lanjutan dari 9_portal_pasien_clinara.sql). Tanpa DROP dan tanpa DELETE; hanya menambah
-- policy dan mengganti fungsi.
--
-- 1) Pesan staf harus konsisten klinik. Policy insert lama hanya memeriksa clinic_id baris itu sama
--    dengan klinik staf, bukan bahwa pasiennya milik klinik yang sama. Staf klinik A yang tahu UUID
--    pasien klinik B bisa menyisipkan pesan yang akan dibaca pasien B lewat aplikasinya.
--    Policy RESTRICTIVE ditambahkan (dan digabung AND dengan policy yang ada) supaya tidak perlu DROP.
create policy portal_messages_patient_same_clinic on public.patient_portal_messages
  as restrictive for insert to authenticated
  with check (exists (
    select 1 from public.patients p
    where p.id = patient_id and p.clinic_id = patient_portal_messages.clinic_id));

-- 2) Akses video untuk staf dibatasi ke peran staf. Sebelumnya semua pengguna login di klinik yang
--    aktif (termasuk akun ber-role pasien/lain bila punya clinic_id) lolos. Saat ini akun pasien
--    tidak punya clinic_id sehingga tidak berdampak, tetapi tidak boleh bergantung pada itu.
create or replace function public.portal_my_clinic_enabled()
returns boolean
language sql security definer stable
set search_path = public
as $fn$
  select get_my_role() = 'super_admin'
      or (get_my_role() in ('owner','admin','clinic_admin','therapist')
          and public.portal_clinic_enabled(get_my_clinic_id()))
$fn$;
