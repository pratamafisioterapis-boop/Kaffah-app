-- Bug: saat appointment di-reschedule ke terapis lain, trg_appointment_update_recap()
-- hanya meng-update daily_recaps.therapist_id ke terapis baru, tapi lupa meng-update
-- daily_recaps.therapist_name (kolom teks terpisah yang dipakai untuk tampilan di
-- Riwayat Kunjungan, daftar SOAP, dsb). Akibatnya therapist_id benar (terapis baru)
-- tapi therapist_name masih menampilkan nama terapis lama.
--
-- Contoh nyata: pasien Syafrudinsyah, appointment 4 Agustus 2026 di-reschedule dari
-- Prasetyo -> Annisa. therapist_id di daily_recaps sudah benar (Annisa) dan SOAP-nya
-- (medical_records.created_by) juga sudah benar tercatat oleh Annisa, tapi
-- therapist_name di daily_recaps masih "Prasetyo Abiyyu D N, S.Kes.,Ftr" sehingga
-- Riwayat Kunjungan salah menampilkan nama terapis.

CREATE OR REPLACE FUNCTION public.trg_appointment_update_recap()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_therapist_name text;
BEGIN
    -- Jika cancelled/no_show/rejected → hapus recap
    IF NEW.status IN ('cancelled', 'no_show', 'rejected') THEN
        DELETE FROM daily_recaps WHERE appointment_id = NEW.id;
        RETURN NEW;
    END IF;

    -- Jika ada perubahan tanggal, terapis, atau status → update recap
    -- TAPI JANGAN PERNAH set start_time / end_time secara otomatis
    -- Itu harus diisi manual oleh terapis
    IF NEW.appointment_date <> OLD.appointment_date OR
       NEW.therapist_id <> OLD.therapist_id OR
       NEW.status <> OLD.status THEN

        IF NEW.therapist_id IS DISTINCT FROM OLD.therapist_id THEN
            SELECT name INTO v_therapist_name FROM physiotherapists WHERE id = NEW.therapist_id;
        END IF;

        UPDATE daily_recaps
        SET
            recap_date     = (NEW.appointment_date AT TIME ZONE 'Asia/Makassar')::date,
            therapist_id   = NEW.therapist_id,
            therapist_name = COALESCE(v_therapist_name, therapist_name),
            updated_at     = NOW()
            -- start_time dan end_time TIDAK diubah di sini
        WHERE appointment_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$function$;

-- Backfill data yang sudah kadung salah: recap yang punya appointment_id (artinya
-- pernah lewat alur reschedule) tapi therapist_name-nya menunjuk ke terapis lain
-- (bukan cuma beda format nama, tapi benar-benar orang yang berbeda dari therapist_id-nya).
UPDATE daily_recaps dr
SET therapist_name = pcorrect.name,
    updated_at = NOW()
FROM physiotherapists pcorrect
WHERE pcorrect.id = dr.therapist_id
  AND dr.appointment_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM physiotherapists pwrong
    WHERE pwrong.name = dr.therapist_name
      AND pwrong.id <> dr.therapist_id
  );
