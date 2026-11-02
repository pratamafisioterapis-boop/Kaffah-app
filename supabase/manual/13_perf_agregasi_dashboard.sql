-- Jalankan lewat SQL Editor di dashboard Supabase.
-- Aman diulang (CREATE OR REPLACE / IF NOT EXISTS) dan hanya MEMBACA data.
-- Fungsi memakai SECURITY INVOKER, jadi RLS tabel tetap berlaku seperti
-- query biasa dari aplikasi: tiap pengguna hanya melihat data kliniknya.

-- 1) Index untuk filter klinik + rentang tanggal (dipakai hampir semua widget)
CREATE INDEX IF NOT EXISTS idx_daily_recaps_clinic_recap_date
  ON public.daily_recaps (clinic_id, recap_date);

-- 2) Total uang masuk (menggantikan unduhan semua baris lalu dijumlah di JS,
--    yang terpotong di 1000 baris). Filter sama dengan getDailyRecapsTotalAmount.
CREATE OR REPLACE FUNCTION public.get_daily_recaps_total_amount(
  p_start date DEFAULT NULL,
  p_end date DEFAULT NULL,
  p_therapist_id uuid DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_search text DEFAULT NULL
) RETURNS numeric
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(SUM(dr.amount), 0)
  FROM public.daily_recaps dr
  WHERE (p_start IS NULL OR dr.revenue_date >= p_start)
    AND (p_end IS NULL OR dr.revenue_date <= p_end)
    AND (p_therapist_id IS NULL OR dr.therapist_id = p_therapist_id)
    AND (p_payment_method IS NULL OR dr.payment_method = p_payment_method)
    AND (
      p_search IS NULL OR btrim(p_search) = ''
      OR dr.guest_name ILIKE '%' || btrim(p_search) || '%'
      OR dr.patient_id IN (SELECT p.id FROM public.patients p WHERE p.full_name ILIKE '%' || btrim(p_search) || '%')
      OR dr.actual_patient_id IN (SELECT p.id FROM public.patients p WHERE p.full_name ILIKE '%' || btrim(p_search) || '%')
    );
$$;

-- 3) Pasien unik & pasien kembali per terapis (kartu status terapis).
--    Hasil identik dengan getTherapistsPatientMetrics, tanpa mengunduh baris.
CREATE OR REPLACE FUNCTION public.get_therapist_patient_metrics(
  p_therapist_ids uuid[],
  p_start date DEFAULT NULL,
  p_end date DEFAULT NULL
) RETURNS TABLE (therapist_id uuid, unique_patients integer, returning_patients integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT t.therapist_id,
         COUNT(*)::integer AS unique_patients,
         COUNT(*) FILTER (WHERE t.visits > 1)::integer AS returning_patients
  FROM (
    SELECT dr.therapist_id, dr.patient_id, COUNT(*) AS visits
    FROM public.daily_recaps dr
    WHERE dr.therapist_id = ANY (p_therapist_ids)
      AND dr.patient_id IS NOT NULL
      AND (p_start IS NULL OR dr.recap_date >= p_start)
      AND (p_end IS NULL OR dr.recap_date <= p_end)
    GROUP BY dr.therapist_id, dr.patient_id
  ) t
  GROUP BY t.therapist_id;
$$;

-- 4) Jumlah recap per jenis layanan (donut Distribusi Layanan).
CREATE OR REPLACE FUNCTION public.get_service_type_counts(
  p_start date DEFAULT NULL,
  p_end date DEFAULT NULL
) RETURNS TABLE (service_type text, total integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT dr.service_type::text, COUNT(*)::integer
  FROM public.daily_recaps dr
  WHERE (p_start IS NULL OR dr.recap_date >= p_start)
    AND (p_end IS NULL OR dr.recap_date <= p_end)
  GROUP BY dr.service_type;
$$;

-- 5) Jumlah recap per hari (grafik Tren Sesi Minggu Ini).
CREATE OR REPLACE FUNCTION public.get_recap_counts_by_day(
  p_start date,
  p_end date
) RETURNS TABLE (recap_day date, total integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT dr.recap_date::date, COUNT(*)::integer
  FROM public.daily_recaps dr
  WHERE dr.recap_date >= p_start AND dr.recap_date <= p_end
  GROUP BY dr.recap_date::date;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_recaps_total_amount(date, date, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_therapist_patient_metrics(uuid[], date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_service_type_counts(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recap_counts_by_day(date, date) TO authenticated;

-- Cek cepat (ganti tanggal sesuai kebutuhan):
-- SELECT public.get_daily_recaps_total_amount('2026-11-01', '2026-11-30');
-- SELECT * FROM public.get_service_type_counts('2026-11-01', '2026-11-30');
-- SELECT * FROM public.get_recap_counts_by_day('2026-11-02', '2026-11-08');
