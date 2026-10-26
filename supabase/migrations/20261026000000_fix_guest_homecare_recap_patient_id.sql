-- Booking tamu/pasien baru dengan layanan homecare gagal: "patient_id tidak boleh kosong".
-- Penyebab: trg_ab_soap_first_prepare mengganti patient_type recap tamu dari 'guest' menjadi
-- label homecare, lalu trg_block_patient_change (berjalan sesudahnya) menolak karena
-- patient_type bukan 'guest' dan patient_id kosong.
-- Perbaikan: recap tetap dianggap tamu bila sebelumnya 'guest' atau punya guest_name.

CREATE OR REPLACE FUNCTION public.block_patient_change_on_recap()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN

    IF NEW.patient_id IS NULL
       AND NEW.patient_type IS DISTINCT FROM 'guest'
       AND OLD.patient_type IS DISTINCT FROM 'guest'
       AND NULLIF(btrim(COALESCE(NEW.guest_name, '')), '') IS NULL THEN
        RAISE EXCEPTION 'patient_id tidak boleh kosong';
    END IF;

    IF NEW.actual_patient_id IS NULL THEN
        NEW.actual_patient_id := NEW.patient_id;
    END IF;

    RETURN NEW;

END;
$function$;
