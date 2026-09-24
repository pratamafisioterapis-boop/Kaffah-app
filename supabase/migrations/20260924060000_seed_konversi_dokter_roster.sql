-- Seed roster tetap untuk akun Konversi Dokter Kaffah (rspb@ihc.id / RS
-- Pertamina Balikpapan): Dokter 29%, Adi 10%, tiga terapis 15,25% masing-
-- masing, dan Om Phius 15,25% dengan aturan "capped" (lihat
-- hitungLaporanFinal di insentifBulananCalc.js).
insert into public.insentif_roster (owner_user_id, nama, persentase, urutan, is_active, is_capped, redistribusi_dari_capped_persen)
values
  ('e9a35994-8c67-43ab-aa70-45fa9cc368b7', 'DOKTER', 29, 0, true, false, null),
  ('e9a35994-8c67-43ab-aa70-45fa9cc368b7', 'ADI', 10, 1, true, false, 28),
  ('e9a35994-8c67-43ab-aa70-45fa9cc368b7', 'TEH DEWI', 15.25, 2, true, false, 24),
  ('e9a35994-8c67-43ab-aa70-45fa9cc368b7', 'MAS RIGI', 15.25, 3, true, false, 24),
  ('e9a35994-8c67-43ab-aa70-45fa9cc368b7', 'MBA YANI', 15.25, 4, true, false, 24),
  ('e9a35994-8c67-43ab-aa70-45fa9cc368b7', 'OM PHIUS', 15.25, 5, true, true, null)
on conflict do nothing;
