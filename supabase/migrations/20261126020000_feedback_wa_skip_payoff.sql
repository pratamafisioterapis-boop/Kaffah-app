-- Kuesioner otomatis Kaffah: kwitansi PELUNASAN paket tidak memicu kuesioner (teks kuesioner "tentang terapi hari ini").
-- Pembelian paket tetap memicu. Aturan lain (belum pernah mengisi, jendela 24 jam, 1 pesan/20 jam) tidak berubah.
--
-- Rollback: jalankan kembali fungsi feedback_wa_enqueue_from_invoice dari 20261125160000_kaffah_feedback_wa_auto.sql.

CREATE OR REPLACE FUNCTION public.feedback_wa_enqueue_from_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient uuid;
  v_payoff boolean;
BEGIN
  BEGIN
    IF EXISTS (SELECT 1 FROM public.feedback_wa_config WHERE clinic_id = NEW.clinic_id AND enabled) THEN
      SELECT patient_id, coalesce(installment_payoff, false) INTO v_patient, v_payoff
        FROM public.daily_recaps WHERE id = NEW.recap_id;
      IF NOT coalesce(v_payoff, false) THEN
        INSERT INTO public.feedback_wa_queue (clinic_id, patient_id, recap_id, due_at)
        VALUES (NEW.clinic_id, v_patient, NEW.recap_id, now() + interval '2 minutes')
        ON CONFLICT (recap_id) DO NOTHING;
      END IF;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'feedback_wa_enqueue_from_invoice: %', SQLERRM; -- jangan pernah menggagalkan kwitansi
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.feedback_wa_enqueue_from_invoice() FROM PUBLIC, anon, authenticated;
