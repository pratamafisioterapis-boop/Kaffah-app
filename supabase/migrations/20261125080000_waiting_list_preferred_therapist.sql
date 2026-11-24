-- Terapis tertentu yang diminta pasien waiting list (mis. "ka Nisa"); kosong = bebas.
ALTER TABLE public.waiting_list ADD COLUMN IF NOT EXISTS preferred_therapist_id uuid REFERENCES public.physiotherapists(id) ON DELETE SET NULL;
