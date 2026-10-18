-- SOAP-first (KHUSUS Kaffah) - tahap 4: pengajuan/persetujuan pengecualian, revisi SOAP, tanda owner, pengingat.
-- Tanpa DROP.

-- Pengajuan pengecualian oleh admin (atau owner: otomatis disetujui).
CREATE OR REPLACE FUNCTION public.soap_first_request_override(
  p_kind text,
  p_recap_id uuid,
  p_reason text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_package_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_role text := get_my_role();
  v_clinic uuid := get_my_clinic_id();
  v_user uuid := auth.uid();
  v_name text;
  v_id uuid;
  v_target_clinic uuid;
  v_label text;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('owner', 'super_admin', 'admin', 'clinic_admin') THEN
    RAISE EXCEPTION 'Anda tidak berhak mengajukan pengecualian.';
  END IF;
  IF p_kind NOT IN ('payment_unlock', 'incentive_restore', 'homecare_discount', 'xtratime', 'package_extend', 'amount_adjust') THEN
    RAISE EXCEPTION 'Jenis pengecualian tidak dikenal.';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Alasan wajib diisi (minimal 5 karakter).';
  END IF;

  IF p_kind = 'package_extend' THEN
    IF p_package_id IS NULL OR NULLIF(p_payload ->> 'new_end_date', '') IS NULL THEN
      RAISE EXCEPTION 'Paket dan tanggal berakhir baru wajib diisi.';
    END IF;
    SELECT COALESCE(pt.clinic_id, pa.clinic_id) INTO v_target_clinic
    FROM package_tracking pt LEFT JOIN patients pa ON pa.id = pt.patient_id
    WHERE pt.id = p_package_id;
  ELSE
    IF p_recap_id IS NULL THEN
      RAISE EXCEPTION 'Recap wajib dipilih.';
    END IF;
    SELECT d.clinic_id INTO v_target_clinic FROM daily_recaps d WHERE d.id = p_recap_id;
    IF p_kind = 'amount_adjust' AND NULLIF(p_payload ->> 'amount', '') IS NULL THEN
      RAISE EXCEPTION 'Nominal baru wajib diisi.';
    END IF;
  END IF;
  IF v_target_clinic IS DISTINCT FROM v_clinic THEN
    RAISE EXCEPTION 'Data tidak ditemukan.';
  END IF;

  SELECT u.full_name INTO v_name FROM users u WHERE u.id = v_user;

  BEGIN
    INSERT INTO soap_overrides (clinic_id, kind, recap_id, package_tracking_id, payload, reason, requested_by, requested_by_name)
    VALUES (v_clinic, p_kind, CASE WHEN p_kind = 'package_extend' THEN NULL ELSE p_recap_id END,
            CASE WHEN p_kind = 'package_extend' THEN p_package_id ELSE NULL END,
            COALESCE(p_payload, '{}'::jsonb), btrim(p_reason), v_user, v_name)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Sudah ada pengajuan yang menunggu persetujuan untuk hal yang sama.';
  END;

  v_label := CASE p_kind
    WHEN 'payment_unlock' THEN 'Buka kunci pembayaran'
    WHEN 'incentive_restore' THEN 'Pulihkan insentif terapis'
    WHEN 'homecare_discount' THEN 'Diskon homecare'
    WHEN 'xtratime' THEN 'Tandai Xtratime'
    WHEN 'package_extend' THEN 'Perpanjang masa aktif paket'
    ELSE 'Ubah nominal' END;

  IF v_role IN ('owner', 'super_admin') THEN
    PERFORM soap_first_decide_override(v_id, true, 'Diajukan dan disetujui oleh owner');
  ELSE
    PERFORM soap_first_notify_owners(v_clinic, 'Pengajuan pengecualian: ' || v_label,
      COALESCE(v_name, 'Admin') || ' - ' || btrim(p_reason), '/owner/overrides');
  END IF;

  RETURN v_id;
END;
$fn$;

-- Keputusan owner.
CREATE OR REPLACE FUNCTION public.soap_first_decide_override(p_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_role text := get_my_role();
  v_clinic uuid := get_my_clinic_id();
  v_user uuid := auth.uid();
  v_name text;
  o soap_overrides;
  v_new_end date;
  v_amount numeric;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('owner', 'super_admin') THEN
    RAISE EXCEPTION 'Hanya owner yang dapat memutuskan pengajuan.';
  END IF;
  SELECT * INTO o FROM soap_overrides WHERE id = p_id AND clinic_id = v_clinic FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan tidak ditemukan.';
  END IF;
  IF o.status <> 'pending' THEN
    RAISE EXCEPTION 'Pengajuan sudah diputuskan.';
  END IF;

  SELECT u.full_name INTO v_name FROM users u WHERE u.id = v_user;
  PERFORM set_config('app.soap_first_rpc', 'on', true);

  IF p_approve THEN
    IF o.kind = 'xtratime' THEN
      UPDATE daily_recaps SET xtratime = true, updated_at = now() WHERE id = o.recap_id AND invoice_created_at IS NULL;
    ELSIF o.kind = 'package_extend' THEN
      v_new_end := (o.payload ->> 'new_end_date')::date;
      UPDATE package_tracking
      SET end_date = v_new_end, extended_until = v_new_end, status = 'diperpanjang', updated_at = now()
      WHERE id = o.package_tracking_id;
    ELSIF o.kind = 'amount_adjust' THEN
      v_amount := NULLIF(o.payload ->> 'amount', '')::numeric;
      UPDATE daily_recaps SET amount_original = v_amount, amount = v_amount, updated_at = now()
      WHERE id = o.recap_id AND invoice_created_at IS NOT NULL;
    END IF;
  END IF;

  UPDATE soap_overrides
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      decided_by = v_user, decided_by_name = v_name, decided_at = now(), decision_note = p_note
  WHERE id = p_id;

  PERFORM set_config('app.soap_first_rpc', 'off', true);

  IF o.requested_by IS NOT NULL AND o.requested_by IS DISTINCT FROM v_user THEN
    PERFORM soap_first_notify(o.requested_by,
      CASE WHEN p_approve THEN 'Pengajuan disetujui' ELSE 'Pengajuan ditolak' END,
      COALESCE(p_note, o.reason), '/admin/daily-recaps', NULL);
  END IF;
END;
$fn$;

-- Tanda audit owner: SOAP dinilai asal-asalan -> insentif sesi itu nol (terapis tidak diberi rincian).
CREATE OR REPLACE FUNCTION public.soap_first_owner_flag(p_recap_id uuid, p_zero boolean, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_role text := get_my_role();
  v_clinic uuid := get_my_clinic_id();
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('owner', 'super_admin') THEN
    RAISE EXCEPTION 'Hanya owner yang dapat menandai SOAP.';
  END IF;
  IF p_zero AND char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Alasan wajib diisi.';
  END IF;
  PERFORM set_config('app.soap_first_rpc', 'on', true);
  UPDATE daily_recaps
  SET incentive_zero_manual = p_zero,
      incentive_zero_manual_reason = CASE WHEN p_zero THEN btrim(p_reason) ELSE NULL END,
      incentive_zero_manual_by = CASE WHEN p_zero THEN auth.uid() ELSE NULL END,
      incentive_zero_manual_at = CASE WHEN p_zero THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_recap_id AND clinic_id = v_clinic;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recap tidak ditemukan.';
  END IF;
  PERFORM set_config('app.soap_first_rpc', 'off', true);
END;
$fn$;

-- Revisi SOAP yang sudah terkunci (jejak audit + pemberitahuan owner).
CREATE OR REPLACE FUNCTION public.soap_first_revise_soap(
  p_record_id uuid,
  p_subjective text,
  p_objective text,
  p_assessment text,
  p_plan text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_role text := get_my_role();
  v_clinic uuid := get_my_clinic_id();
  v_user uuid := auth.uid();
  v_name text;
  m medical_records;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('owner', 'super_admin', 'therapist') THEN
    RAISE EXCEPTION 'Hanya terapis atau owner yang dapat merevisi SOAP.';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Alasan revisi wajib diisi (minimal 5 karakter).';
  END IF;
  SELECT * INTO m FROM medical_records WHERE id = p_record_id AND clinic_id = v_clinic FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOAP tidak ditemukan.';
  END IF;
  IF v_role = 'therapist' AND m.created_by IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'Anda hanya dapat merevisi SOAP milik Anda sendiri.';
  END IF;

  SELECT u.full_name INTO v_name FROM users u WHERE u.id = v_user;
  PERFORM set_config('app.soap_first_rpc', 'on', true);

  INSERT INTO soap_revisions (clinic_id, medical_record_id, revised_by, revised_by_name, reason, old_values, new_values)
  VALUES (
    v_clinic, m.id, v_user, v_name, btrim(p_reason),
    jsonb_build_object('subjective', m.subjective, 'objective', m.objective, 'assessment', m.assessment, 'plan', m.plan),
    jsonb_build_object('subjective', p_subjective, 'objective', p_objective, 'assessment', p_assessment, 'plan', p_plan)
  );

  UPDATE medical_records
  SET subjective = p_subjective, objective = p_objective, assessment = p_assessment, plan = p_plan, updated_at = now()
  WHERE id = m.id;

  PERFORM set_config('app.soap_first_rpc', 'off', true);
  PERFORM soap_first_notify_owners(v_clinic, 'SOAP direvisi', COALESCE(v_name, 'Terapis') || ' - ' || btrim(p_reason), '/owner/overrides');
END;
$fn$;

-- Pengingat SOAP (dipanggil cron tiap menit). Menit ke-N sejak slot mulai: terapis + admin.
-- Saat slot berakhir: terapis saja.
CREATE OR REPLACE FUNCTION public.soap_first_send_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  r record;
  adm record;
  v_count integer := 0;
BEGIN
  PERFORM set_config('app.soap_first_rpc', 'on', true);

  FOR r IN
    SELECT d.id AS recap_id, d.clinic_id, d.appointment_id,
           COALESCE(NULLIF(btrim(d.full_name), ''), NULLIF(btrim(d.guest_name), ''), 'Pasien') AS patient_name,
           p.user_id AS therapist_user, COALESCE(p.name, 'Terapis') AS therapist_name
    FROM daily_recaps d
    JOIN soap_first_settings s ON s.clinic_id = d.clinic_id AND s.enabled AND d.recap_date >= s.start_date
    JOIN appointments a ON a.id = d.appointment_id AND a.status IN ('confirmed', 'rescheduled')
    LEFT JOIN physiotherapists p ON p.id = d.therapist_id
    WHERE d.recap_date = (now() AT TIME ZONE 'Asia/Makassar')::date
      AND d.soap_completed_at IS NULL
      AND d.soap_reminder1_at IS NULL
      AND now() >= a.appointment_date + make_interval(mins => s.reminder_after_minutes)
  LOOP
    PERFORM soap_first_notify(r.therapist_user, 'Segera isi SOAP',
      'SOAP pasien ' || r.patient_name || ' belum diisi. Isi sebelum pasien melakukan pembayaran.',
      '/therapist/records', r.appointment_id);
    FOR adm IN SELECT u.id FROM users u WHERE u.clinic_id = r.clinic_id AND u.role IN ('admin', 'clinic_admin') AND COALESCE(u.is_active, true) LOOP
      PERFORM soap_first_notify(adm.id, 'SOAP belum diisi terapis',
        r.therapist_name || ' belum mengisi SOAP pasien ' || r.patient_name || '. Mohon diingatkan.',
        '/admin/daily-recaps', r.appointment_id);
    END LOOP;
    UPDATE daily_recaps SET soap_reminder1_at = now() WHERE id = r.recap_id;
    v_count := v_count + 1;
  END LOOP;

  FOR r IN
    SELECT d.id AS recap_id, d.appointment_id,
           COALESCE(NULLIF(btrim(d.full_name), ''), NULLIF(btrim(d.guest_name), ''), 'Pasien') AS patient_name,
           p.user_id AS therapist_user
    FROM daily_recaps d
    JOIN soap_first_settings s ON s.clinic_id = d.clinic_id AND s.enabled AND d.recap_date >= s.start_date
    JOIN appointments a ON a.id = d.appointment_id AND a.status IN ('confirmed', 'rescheduled')
    LEFT JOIN physiotherapists p ON p.id = d.therapist_id
    WHERE d.recap_date = (now() AT TIME ZONE 'Asia/Makassar')::date
      AND d.soap_completed_at IS NULL
      AND d.soap_reminder2_at IS NULL
      AND now() >= a.appointment_date + make_interval(mins => COALESCE(a.duration_minutes, 0))
  LOOP
    PERFORM soap_first_notify(r.therapist_user, 'SOAP belum diisi',
      'Sesi pasien ' || r.patient_name || ' telah berakhir. Mohon segera isi SOAP.',
      '/therapist/records', r.appointment_id);
    UPDATE daily_recaps SET soap_reminder2_at = now() WHERE id = r.recap_id;
    v_count := v_count + 1;
  END LOOP;

  PERFORM set_config('app.soap_first_rpc', 'off', true);
  RETURN v_count;
END;
$fn$;

REVOKE ALL ON FUNCTION public.soap_first_request_override(text, uuid, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soap_first_request_override(text, uuid, text, jsonb, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.soap_first_decide_override(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soap_first_decide_override(uuid, boolean, text) TO authenticated;
REVOKE ALL ON FUNCTION public.soap_first_owner_flag(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soap_first_owner_flag(uuid, boolean, text) TO authenticated;
REVOKE ALL ON FUNCTION public.soap_first_revise_soap(uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soap_first_revise_soap(uuid, text, text, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.soap_first_send_reminders() FROM PUBLIC, anon, authenticated;
