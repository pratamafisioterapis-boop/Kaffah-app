-- Pembatalan izin yang sudah terlanjur disetujui. Saat dibatalkan:
--   * baris libur (therapist_time_off) dihapus  -> slot hari izin dibuka kembali,
--   * jadwal masuk pengganti (therapist_extra_shifts) dihapus -> slot pengganti ditutup
--     (slot yang sudah punya booking aktif tetap dipertahankan oleh regenerate_slots).
-- Pengajuan tetap tercatat dengan status 'rejected' + revoked_at terisi
-- (ditampilkan sebagai "Dibatalkan"), sehingga constraint status tidak berubah.

ALTER TABLE public.therapist_leave_requests
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoked_by_name text,
  ADD COLUMN IF NOT EXISTS revoke_note text;

-- Mengembalikan jumlah booking aktif yang masih ada di tanggal pengganti
-- (slotnya dipertahankan, perlu dijadwalkan ulang manual oleh admin).
CREATE OR REPLACE FUNCTION public.revoke_therapist_leave_request(
  p_request_id uuid,
  p_note text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_req public.therapist_leave_requests%ROWTYPE;
  v_role text := get_my_role();
  v_name text;
  v_booked integer := 0;
BEGIN
  SELECT * INTO v_req FROM public.therapist_leave_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan tidak ditemukan';
  END IF;

  IF v_role = 'super_admin' OR (v_role = 'owner' AND v_req.clinic_id = get_my_clinic_id()) THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Hanya owner yang dapat membatalkan izin yang sudah disetujui';
  END IF;

  IF v_req.status <> 'approved' THEN
    RAISE EXCEPTION 'Hanya izin yang berstatus disetujui yang dapat dibatalkan';
  END IF;

  SELECT COALESCE(
           (SELECT u.full_name FROM public.users u WHERE u.id = auth.uid()),
           'Owner')
    INTO v_name;

  -- Booking aktif yang masih menempel di jadwal pengganti (dihitung sebelum dihapus).
  SELECT COUNT(*) INTO v_booked
    FROM public.appointments a
    JOIN public.therapist_extra_shifts e
      ON e.leave_request_id = v_req.id
     AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::date = e.shift_date
     AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time >= e.start_time
     AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time < e.end_time
   WHERE a.therapist_id = v_req.therapist_id
     AND a.status IN ('confirmed', 'pending', 'scheduled', 'rescheduled');

  -- Jadwal masuk pengganti dulu (trigger membuat ulang slot tiap tanggal), lalu libur.
  DELETE FROM public.therapist_extra_shifts WHERE leave_request_id = v_req.id;

  IF v_req.time_off_id IS NOT NULL THEN
    DELETE FROM public.therapist_time_off WHERE id = v_req.time_off_id;
  END IF;

  UPDATE public.therapist_leave_requests
    SET status = 'rejected',
        revoked_at = now(),
        revoked_by = auth.uid(),
        revoked_by_name = v_name,
        revoke_note = NULLIF(btrim(COALESCE(p_note, '')), ''),
        time_off_id = NULL
    WHERE id = p_request_id;

  RETURN v_booked;
END;
$fn$;

REVOKE ALL ON FUNCTION public.revoke_therapist_leave_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_therapist_leave_request(uuid, text) TO authenticated;

-- Notifikasi: pembatalan dikirim sebagai "Izin Dibatalkan", bukan "Izin Ditolak".
CREATE OR REPLACE FUNCTION public.notify_leave_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_target RECORD;
  v_date text;
  v_who text;
  v_scope text;
BEGIN
  v_date := to_char(NEW.leave_date, 'DD-MM-YYYY');
  v_who := COALESCE(NULLIF(NEW.therapist_name, ''), 'Terapis');
  v_scope := CASE WHEN NEW.is_partial
    THEN 'pukul ' || to_char(NEW.start_time, 'HH24:MI') || '–' || to_char(NEW.end_time, 'HH24:MI')
    ELSE 'seharian' END;

  IF TG_OP = 'INSERT' THEN
    FOR v_target IN
      SELECT u.id, 'owner'::text AS kind FROM public.users u
        WHERE u.role = 'owner' AND u.clinic_id = NEW.clinic_id
      UNION
      SELECT p.user_id, 'head' FROM public.physiotherapists p
        WHERE p.is_head_therapist AND p.is_active IS NOT FALSE
          AND p.clinic_id = NEW.clinic_id AND p.user_id IS NOT NULL
          AND p.user_id <> NEW.requested_by
    LOOP
      BEGIN
        PERFORM net.http_post(
          url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-push-notification',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'user_id', v_target.id,
            'title', '🗓️ Pengajuan Izin Terapis',
            'body', v_who || ' mengajukan izin ' || v_scope || ' pada ' || v_date || '. Menunggu persetujuan Anda.',
            'url', CASE WHEN v_target.kind = 'owner'
              THEN '/owner/physiotherapist-management?tab=timeoff'
              ELSE '/therapist/leave' END
          )
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-push-notification',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'user_id', NEW.requested_by,
          'title', CASE
            WHEN NEW.revoked_at IS NOT NULL THEN '↩️ Izin Dibatalkan'
            WHEN NEW.status = 'approved' THEN '✅ Izin Disetujui'
            ELSE '❌ Izin Ditolak' END,
          'body', CASE
            WHEN NEW.revoked_at IS NOT NULL THEN
              'Persetujuan izin ' || v_scope || ' pada ' || v_date
                || ' dibatalkan. Jadwal Anda kembali seperti semula.'
                || CASE WHEN NEW.revoke_note IS NOT NULL THEN ' Catatan: ' || NEW.revoke_note ELSE '' END
            ELSE
              'Izin ' || v_scope || ' pada ' || v_date
                || CASE WHEN NEW.status = 'approved' THEN ' disetujui.' ELSE ' ditolak.' END
                || CASE WHEN NEW.review_note IS NOT NULL THEN ' Catatan: ' || NEW.review_note ELSE '' END
            END,
          'url', '/therapist/leave'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.notify_leave_request() FROM PUBLIC, anon, authenticated;
