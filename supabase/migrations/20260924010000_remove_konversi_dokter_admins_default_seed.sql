-- Access to Konversi Dokter should only ever be granted explicitly by a
-- super_admin via the Manajemen User page, never defaulted onto a
-- particular clinic account (the original migration auto-added
-- ownersuper@kaffah.com to preserve continuity — that default is removed
-- here so a super_admin has to grant it deliberately).
delete from public.konversi_dokter_admins
where user_id = (select id from public.users where email = 'ownersuper@kaffah.com');
