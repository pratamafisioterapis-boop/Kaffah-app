-- Tanda tangan per-admin + pencatat admin pembuat invoice (recap).
-- users.signature_url: tanda tangan admin (diunggah admin di Pengaturan Akun).
-- daily_recaps.created_by: admin yang pertama kali membuat recap/invoice;
--   terisi otomatis dari auth.uid() saat insert, sehingga nama penanda tangan
--   invoice tidak berubah ketika dibuka admin lain.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS signature_url text;

ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL;
