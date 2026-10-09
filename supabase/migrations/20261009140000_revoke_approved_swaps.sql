-- Pembatalan tukar shift & tukar jadwal Minggu yang sudah terlanjur disetujui.
--   * Tukar shift: override jam kerja tanggal itu dihapus -> jam kembali ke jadwal mingguan.
--   * Tukar Minggu: libur pemohon dihapus + jam masuk pengganti dihapus -> jadwal kembali semula.
-- Pengajuan tetap tercatat dengan status 'rejected' + revoked_at (tampil "Dibatalkan").
-- Slot yang sudah punya booking aktif dipertahankan oleh regenerate_slots.

ALTER TABLE public.therapist_shift_swap_requests
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoked_by_name text,
  ADD COLUMN IF NOT EXISTS revoke_note text;

ALTER TABLE public.therapist_sunday_swap_requests
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoked_by_name text,
  ADD COLUMN IF NOT EXISTS revoke_note text;

CREATE OR REPLACE FUNCTION public.revoke_therapist_shift_swap_request(
  p_request_id uuid,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_req public.therapist_shift_swap_requests%ROWTYPE;
  v_role text := get_my_role();
  v_name text;
BEGIN
  SELECT * INTO v_req FROM public.therapist_shift_swap_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan tidak ditemukan';
  END IF;
  IF NOT (v_role = 'super_admin' OR (v_role = 'owner' AND v_req.clinic_id = get_my_clinic_id())) THEN
    RAISE EXCEPTION 'Hanya owner yang dapat membatalkan tukar shift yang sudah disetujui';
  END IF;
  IF v_req.status <> 'approved' THEN
    RAISE EXCEPTION 'Hanya tukar shift yang berstatus disetujui yang dapat dibatalkan';
  END IF;

  SELECT COALESCE((SELECT u.full_name FROM public.users u WHERE u.id = auth.uid()), 'Owner') INTO v_name;

  IF v_req.override_id IS NOT NULL THEN
    DELETE FROM public.therapist_schedule_overrides WHERE id = v_req.override_id;
  END IF;

  UPDATE public.therapist_shift_swap_requests
    SET status = 'rejected',
        revoked_at = now(),
        revoked_by = auth.uid(),
        revoked_by_name = v_name,
        revoke_note = NULLIF(btrim(COALESCE(p_note, '')), ''),
        override_id = NULL
    WHERE id = p_request_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.revoke_therapist_shift_swap_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_therapist_shift_swap_request(uuid, text) TO authenticated;

-- Mengembalikan jumlah booking aktif yang masih ada di jam masuk pengganti.
CREATE OR REPLACE FUNCTION public.revoke_sunday_swap_request(
  p_request_id uuid,
  p_note text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_req public.therapist_sunday_swap_requests%ROWTYPE;
  v_role text := get_my_role();
  v_name text;
  v_booked integer := 0;
BEGIN
  SELECT * INTO v_req FROM public.therapist_sunday_swap_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan tidak ditemukan';
  END IF;
  IF NOT (v_role = 'super_admin' OR (v_role = 'owner' AND v_req.clinic_id = get_my_clinic_id())) THEN
    RAISE EXCEPTION 'Hanya owner yang dapat membatalkan tukar jadwal yang sudah disetujui';
  END IF;
  IF v_req.status <> 'approved' THEN
    RAISE EXCEPTION 'Hanya tukar jadwal yang berstatus disetujui yang dapat dibatalkan';
  END IF;

  SELECT COALESCE((SELECT u.full_name FROM public.users u WHERE u.id = auth.uid()), 'Owner') INTO v_name;

  SELECT COUNT(*) INTO v_booked
    FROM public.appointments a
   WHERE a.therapist_id = v_req.substitute_id
     AND a.status IN ('confirmed', 'pending', 'scheduled', 'rescheduled')
     AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::date = v_req.swap_date
     AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time >= v_req.start_time
     AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time < v_req.end_time;

  DELETE FROM public.therapist_extra_shifts WHERE sunday_swap_id = v_req.id;

  IF v_req.time_off_id IS NOT NULL THEN
    DELETE FROM public.therapist_time_off WHERE id = v_req.time_off_id;
  END IF;

  UPDATE public.therapist_sunday_swap_requests
    SET status = 'rejected',
        rejected_by = 'owner',
        revoked_at = now(),
        revoked_by = auth.uid(),
        revoked_by_name = v_name,
        revoke_note = NULLIF(btrim(COALESCE(p_note, '')), ''),
        time_off_id = NULL
    WHERE id = p_request_id;

  RETURN v_booked;
END;
$fn$;
REVOKE ALL ON FUNCTION public.revoke_sunday_swap_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_sunday_swap_request(uuid, text) TO authenticated;

-- Notifikasi tukar shift: pembatalan dikirim sebagai "Dibatalkan", bukan "Ditolak".
CREATE OR REPLACE FUNCTION public.notify_shift_swap_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_target RECORD;
  v_date text := to_char(NEW.swap_date, 'DD-MM-YYYY');
  v_who text := COALESCE(NULLIF(NEW.therapist_name, ''), 'Terapis');
  v_to text := COALESCE(NULLIF(NEW.to_shift_name, ''), 'shift lain')
    || ' (' || to_char(NEW.to_start_time, 'HH24:MI') || '–' || to_char(NEW.to_end_time, 'HH24:MI') || ')';
BEGIN
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
            'title', '🔁 Pengajuan Tukar Shift',
            'body', v_who || ' mengajukan tukar shift ke ' || v_to || ' pada ' || v_date || '. Menunggu persetujuan Anda.',
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
            WHEN NEW.revoked_at IS NOT NULL THEN '↩️ Tukar Shift Dibatalkan'
            WHEN NEW.status = 'approved' THEN '✅ Tukar Shift Disetujui'
            ELSE '❌ Tukar Shift Ditolak' END,
          'body', CASE
            WHEN NEW.revoked_at IS NOT NULL THEN
              'Persetujuan tukar shift ke ' || v_to || ' pada ' || v_date
                || ' dibatalkan. Jam kerja Anda kembali seperti semula.'
                || CASE WHEN NEW.revoke_note IS NOT NULL THEN ' Catatan: ' || NEW.revoke_note ELSE '' END
            ELSE
              'Tukar shift ke ' || v_to || ' pada ' || v_date
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
REVOKE EXECUTE ON FUNCTION public.notify_shift_swap_request() FROM PUBLIC, anon, authenticated;

-- Notifikasi tukar Minggu: pembatalan ke pemohon + pengganti.
CREATE OR REPLACE FUNCTION public.notify_sunday_swap_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_owner RECORD;
  v_date text := to_char(NEW.swap_date, 'DD-MM-YYYY');
  v_who text := COALESCE(NULLIF(NEW.therapist_name, ''), 'Terapis');
  v_sub text := COALESCE(NULLIF(NEW.substitute_name, ''), 'rekan');
  v_url text := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-push-notification';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.substitute_user_id IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(url := v_url, headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'user_id', NEW.substitute_user_id,
            'title', '🔄 Permintaan Tukar Jadwal',
            'body', v_who || ' meminta Anda menggantikan jadwal masuk hari Minggu ' || v_date
              || ' (' || to_char(NEW.start_time, 'HH24:MI') || '–' || to_char(NEW.end_time, 'HH24:MI') || '). Mohon konfirmasi.',
            'url', '/therapist/leave?tab=sunday'));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'pending_owner' THEN
      FOR v_owner IN SELECT u.id FROM public.users u WHERE u.role = 'owner' AND u.clinic_id = NEW.clinic_id LOOP
        BEGIN
          PERFORM net.http_post(url := v_url, headers := '{"Content-Type": "application/json"}'::jsonb,
            body := jsonb_build_object(
              'user_id', v_owner.id,
              'title', '🔄 Pengajuan Tukar Jadwal',
              'body', v_who || ' tukar jadwal Minggu ' || v_date || ' dengan ' || v_sub
                || ' (sudah disetujui ' || v_sub || '). Menunggu persetujuan Anda.',
              'url', '/owner/physiotherapist-management?tab=timeoff'));
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END LOOP;
      BEGIN
        PERFORM net.http_post(url := v_url, headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'user_id', NEW.requested_by,
            'title', '👍 ' || v_sub || ' Bersedia Menggantikan',
            'body', v_sub || ' menerima tukar jadwal Minggu ' || v_date || '. Menunggu persetujuan owner.',
            'url', '/therapist/leave?tab=sunday'));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    ELSIF NEW.status = 'rejected' AND NEW.rejected_by = 'substitute' THEN
      BEGIN
        PERFORM net.http_post(url := v_url, headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'user_id', NEW.requested_by,
            'title', '❌ Tukar Jadwal Ditolak ' || v_sub,
            'body', v_sub || ' tidak bisa menggantikan Minggu ' || v_date || '.'
              || CASE WHEN NEW.substitute_note IS NOT NULL THEN ' Catatan: ' || NEW.substitute_note ELSE '' END
              || ' Silakan pilih terapis lain.',
            'url', '/therapist/leave?tab=sunday'));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    ELSIF NEW.status IN ('approved', 'rejected') THEN
      BEGIN
        PERFORM net.http_post(url := v_url, headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'user_id', NEW.requested_by,
            'title', CASE
              WHEN NEW.revoked_at IS NOT NULL THEN '↩️ Tukar Jadwal Dibatalkan'
              WHEN NEW.status = 'approved' THEN '✅ Tukar Jadwal Disetujui'
              ELSE '❌ Tukar Jadwal Ditolak Owner' END,
            'body', CASE
              WHEN NEW.revoked_at IS NOT NULL THEN
                'Persetujuan tukar jadwal Minggu ' || v_date || ' dengan ' || v_sub
                  || ' dibatalkan. Jadwal Anda kembali seperti semula.'
                  || CASE WHEN NEW.revoke_note IS NOT NULL THEN ' Catatan: ' || NEW.revoke_note ELSE '' END
              ELSE
                'Tukar jadwal Minggu ' || v_date || ' dengan ' || v_sub
                  || CASE WHEN NEW.status = 'approved' THEN ' disetujui. Anda libur di tanggal itu.' ELSE ' ditolak.' END
                  || CASE WHEN NEW.review_note IS NOT NULL THEN ' Catatan: ' || NEW.review_note ELSE '' END
              END,
            'url', '/therapist/leave?tab=sunday'));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
      IF NEW.substitute_user_id IS NOT NULL THEN
        BEGIN
          PERFORM net.http_post(url := v_url, headers := '{"Content-Type": "application/json"}'::jsonb,
            body := jsonb_build_object(
              'user_id', NEW.substitute_user_id,
              'title', CASE
                WHEN NEW.revoked_at IS NOT NULL THEN 'ℹ️ Tukar Jadwal Dibatalkan'
                WHEN NEW.status = 'approved' THEN '✅ Jadwal Minggu Anda Dikonfirmasi'
                ELSE 'ℹ️ Tukar Jadwal Dibatalkan' END,
              'body', CASE
                WHEN NEW.revoked_at IS NOT NULL THEN
                  'Owner membatalkan tukar jadwal Minggu ' || v_date || '. Anda kembali libur di tanggal itu.'
                WHEN NEW.status = 'approved'
                  THEN 'Anda bertugas menggantikan ' || v_who || ' pada Minggu ' || v_date
                    || ' (' || to_char(NEW.start_time, 'HH24:MI') || '–' || to_char(NEW.end_time, 'HH24:MI') || ').'
                ELSE 'Owner menolak tukar jadwal Minggu ' || v_date || '. Anda tetap libur.' END,
              'url', '/therapist/leave?tab=sunday'));
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.notify_sunday_swap_request() FROM PUBLIC, anon, authenticated;
