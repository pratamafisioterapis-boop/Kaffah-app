-- Penandatangan SK bisa diisi per-SK (nama lengkap dengan gelar & jabatan).
ALTER TABLE public.clinic_leadership_decrees
  ADD COLUMN IF NOT EXISTS signer_name text,
  ADD COLUMN IF NOT EXISTS signer_position text;
