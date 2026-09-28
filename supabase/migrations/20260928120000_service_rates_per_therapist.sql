-- Izinkan tarif jasa per Tipe Pasien di-custom untuk terapis tertentu. Baris
-- service_rates dengan therapist_id NULL tetap jadi tarif umum (berlaku untuk
-- semua terapis, perilaku lama). Baris dengan therapist_id terisi jadi
-- override yang hanya berlaku untuk terapis tsb dan didahulukan atas tarif
-- umum saat dicocokkan (lihat buildPatientTypeRateIndex/resolvePatientTypeRate
-- di src/lib/utils.js).

ALTER TABLE public.service_rates
  ADD COLUMN IF NOT EXISTS therapist_id uuid REFERENCES public.physiotherapists(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_service_rates_therapist_id
  ON public.service_rates (therapist_id);

-- service_rates_service_name_key adalah UNIQUE(service_name) GLOBAL, yang
-- menghalangi fitur override per terapis di atas: override terapis PASTI
-- memakai service_name yang sama dengan tarif umum yang di-override-nya.
-- Ganti jadi unique yang di-scope per klinik + per terapis (baris umum,
-- therapist_id NULL, punya scope sendiri lewat coalesce).
ALTER TABLE public.service_rates DROP CONSTRAINT IF EXISTS service_rates_service_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_rates_unique_name_scope
  ON public.service_rates (clinic_id, service_name, coalesce(therapist_id, '00000000-0000-0000-0000-000000000000'::uuid));
