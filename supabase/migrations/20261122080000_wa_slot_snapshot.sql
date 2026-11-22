-- Snapshot slot kosong per tanggal: dipakai penyapu untuk mendeteksi slot yang BARU kosong
-- (pembatalan, reschedule, cuti dicabut) bagi peringatan waiting list ke Telegram.
CREATE TABLE IF NOT EXISTS public.wa_slot_snapshot (
  clinic_id    uuid NOT NULL,
  slot_date    date NOT NULL,
  therapist_id uuid NOT NULL,
  slot_time    text NOT NULL,
  PRIMARY KEY (clinic_id, slot_date, therapist_id, slot_time)
);
CREATE TABLE IF NOT EXISTS public.wa_slot_snapshot_dates (
  clinic_id  uuid NOT NULL,
  slot_date  date NOT NULL,
  taken_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_id, slot_date)
);
ALTER TABLE public.wa_slot_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_slot_snapshot_dates ENABLE ROW LEVEL SECURITY;
