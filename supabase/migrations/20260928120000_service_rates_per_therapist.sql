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
