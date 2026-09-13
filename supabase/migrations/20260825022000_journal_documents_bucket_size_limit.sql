-- Batas ukuran bucket tidak bisa melebihi batas global project (diatur di
-- Dashboard: Project Settings > Storage > Max file size). Ini menaikkan
-- batas KHUSUS bucket journal-documents ke 250MB supaya jurnal/ebook tebal
-- (misal buku teks fisioterapi ratusan halaman) bisa diunggah, selama
-- batas global project juga sudah dinaikkan minimal segitu.
UPDATE storage.buckets
SET file_size_limit = 262144000 -- 250MB dalam bytes
WHERE id = 'journal-documents';
