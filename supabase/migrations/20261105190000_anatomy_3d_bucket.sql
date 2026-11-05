-- Bucket model anatomi 3D (menu "Anatomi 3D" di akun terapis).
-- Isi: file .glb open-source (Z-Anatomy / BodyParts3D), bukan data pasien, jadi dibuat publik
-- supaya bisa di-cache browser/CDN. Nama file: skeleton.glb, joints.glb, muscles.glb, nerves.glb,
-- arteries.glb, veins.glb, organs.glb, skin.glb — atau satu file gabungan full.glb.
-- Hanya super admin yang boleh mengunggah/mengganti.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anatomy-3d', 'anatomy-3d', true, 104857600, array['model/gltf-binary','application/octet-stream'])
on conflict (id) do nothing;

-- Daftar file (dipakai viewer untuk tahu lapisan mana yang tersedia).
create policy anatomy_3d_obj_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'anatomy-3d');
create policy anatomy_3d_obj_write on storage.objects for all to authenticated
  using (bucket_id = 'anatomy-3d' and public.get_my_role() = 'super_admin')
  with check (bucket_id = 'anatomy-3d' and public.get_my_role() = 'super_admin');
