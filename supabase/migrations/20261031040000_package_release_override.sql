-- Pengajuan "Lepas dari paket": sesi yang tertaut otomatis ke kuota paket (nominal Rp 0) padahal
-- pasien memutuskan membayar reguler (mis. batal memakai paket, termasuk paket milik orang lain
-- seperti paket orang tua). Selama masih tertaut, nominal dan metode pembayaran terkunci
-- (block_amount_edit_on_package_session) dan edit biasa tidak boleh melepas paket
-- (updateDailyRecap sengaja mengabaikan package_tracking_id kosong).
-- Admin mengajukan alasan -> owner menyetujui. Setelah disetujui: tautan paket dilepas, kuota paket
-- kembali (trigger after_recap_create_package menghitung ulang paket lama), sesi menjadi
-- reguler Rp 0 yang bisa diisi nominal & metode pembayarannya lewat Edit Data.

ALTER TABLE public.soap_overrides DROP CONSTRAINT IF EXISTS soap_overrides_kind_check;
ALTER TABLE public.soap_overrides ADD CONSTRAINT soap_overrides_kind_check
  CHECK (kind IN ('payment_unlock', 'incentive_restore', 'homecare_discount', 'xtratime', 'package_extend', 'amount_adjust', 'manual_discount', 'vitals_edit', 'recovery_outside_package', 'discount_adjust', 'recap_delete', 'package_change', 'package_release'));

-- Validasi bersama untuk pengajuan dan penerapan; mengembalikan info paket untuk pratinjau owner.
CREATE OR REPLACE FUNCTION public.package_release_check(p_recap_id uuid, p_clinic uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  d public.daily_recaps;
  v_pkg public.package_tracking;
  v_owner text;
BEGIN
  SELECT * INTO d FROM daily_recaps WHERE id = p_recap_id AND clinic_id = p_clinic;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data tidak ditemukan.';
  END IF;
  IF d.package_tracking_id IS NULL THEN
    RAISE EXCEPTION 'Sesi ini tidak tertaut ke paket.';
  END IF;
  IF COALESCE(d.is_package_purchase, false) OR COALESCE(d.amount_original, d.amount, 0) <> 0 THEN
    RAISE EXCEPTION 'Sesi pembelian paket tidak dapat dilepas dari paket.';
  END IF;
  SELECT * INTO v_pkg FROM package_tracking WHERE id = d.package_tracking_id;
  SELECT pt.full_name INTO v_owner FROM patients pt WHERE pt.id = v_pkg.patient_id;
  RETURN jsonb_build_object(
    'package_id', v_pkg.id,
    'package_name', v_pkg.package_name,
    'package_owner', v_owner,
    'sessions_used', v_pkg.sessions_used,
    'total_sessions', v_pkg.total_sessions,
    'invoice_issued', d.invoice_created_at IS NOT NULL);
END;
$function$;

CREATE OR REPLACE FUNCTION public.package_release_apply(p_recap_id uuid, p_clinic uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.daily_recaps;
  v_label text;
  v_cur_sessions integer;
BEGIN
  PERFORM 1 FROM daily_recaps WHERE id = p_recap_id AND clinic_id = p_clinic FOR UPDATE;
  PERFORM package_release_check(p_recap_id, p_clinic);
  SELECT * INTO r FROM daily_recaps WHERE id = p_recap_id;

  -- Jenis paket sesi kembali ke tipe satu sesi (REGULER) supaya tidak tertaut ulang otomatis.
  SELECT COALESCE(o.session_count, 0) INTO v_cur_sessions
  FROM operational_options o
  WHERE o.clinic_id = p_clinic AND o.category = 'tipe_paket' AND lower(btrim(o.label)) = lower(btrim(COALESCE(r.package_type, '')))
  LIMIT 1;
  IF r.package_type IS NOT NULL AND COALESCE(v_cur_sessions, 0) = 1 THEN
    v_label := r.package_type;
  ELSE
    SELECT o.label INTO v_label
    FROM operational_options o
    WHERE o.clinic_id = p_clinic AND o.category = 'tipe_paket' AND COALESCE(o.session_count, 0) <= 1
    ORDER BY (lower(btrim(o.label)) = 'reguler') DESC, o.label
    LIMIT 1;
    v_label := COALESCE(v_label, 'REGULER');
  END IF;

  -- Kuota paket kembali lewat trigger after_recap_create_package. Bila invoice Rp 0 sudah terbit,
  -- invoice itu tidak berlaku lagi (nominal akan diisi ulang) sehingga perlu diterbitkan ulang.
  UPDATE daily_recaps
  SET package_tracking_id = NULL,
      amount_package = NULL,
      session_info = NULL,
      is_auto_filled_pkg = false,
      package_type = v_label,
      payment_method = CASE WHEN payment_method = 'Package' THEN NULL ELSE payment_method END,
      invoice_created_at = NULL,
      invoice_url = NULL,
      updated_at = now()
  WHERE id = p_recap_id AND clinic_id = p_clinic;
END;
$function$;

REVOKE ALL ON FUNCTION public.package_release_check(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.package_release_apply(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_package_release(p_recap_id uuid, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := get_my_role();
  v_clinic uuid := get_my_clinic_id();
  v_user uuid := auth.uid();
  v_name text;
  v_id uuid;
  v_info jsonb;
  d public.daily_recaps;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('owner', 'super_admin', 'admin', 'clinic_admin') THEN
    RAISE EXCEPTION 'Anda tidak berhak mengajukan pengecualian.';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Alasan wajib diisi (minimal 5 karakter).';
  END IF;
  SELECT * INTO d FROM daily_recaps WHERE id = p_recap_id AND clinic_id = v_clinic;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data tidak ditemukan.';
  END IF;
  v_info := package_release_check(p_recap_id, v_clinic);
  SELECT u.full_name INTO v_name FROM users u WHERE u.id = v_user;

  BEGIN
    INSERT INTO soap_overrides (clinic_id, kind, recap_id, payload, reason, requested_by, requested_by_name)
    VALUES (v_clinic, 'package_release', p_recap_id, v_info, btrim(p_reason), v_user, v_name)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Sudah ada pengajuan yang menunggu persetujuan untuk hal yang sama.';
  END;

  IF v_role IN ('owner', 'super_admin') THEN
    PERFORM soap_first_decide_override(v_id, true, 'Diajukan dan disetujui oleh owner');
  ELSE
    PERFORM soap_first_notify_owners(v_clinic, 'Pengajuan pengecualian: Lepas dari paket',
      COALESCE(v_name, 'Admin') || ' - ' || btrim(p_reason), '/owner/overrides');
  END IF;
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.request_package_release(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_package_release(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.soap_first_decide_override(p_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := get_my_role();
  v_clinic uuid := get_my_clinic_id();
  v_user uuid := auth.uid();
  v_name text;
  o soap_overrides;
  v_new_end date;
  v_amount numeric;
  v jsonb;
  v_appt uuid;
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
      -- Nominal yang disetujui adalah nominal akhir: diskon lama dikosongkan, kalau tidak trigger
      -- apply_discount_to_amount memotongnya lagi dari nominal baru (diskon terhitung dua kali).
      UPDATE daily_recaps
      SET amount_original = v_amount, amount = v_amount,
          discount_type = NULL, discount_value = 0, discount_label = NULL,
          updated_at = now()
      WHERE id = o.recap_id AND invoice_created_at IS NOT NULL;
    ELSIF o.kind = 'discount_adjust' THEN
      -- Jangan menulis amount: trigger apply_discount_to_amount menganggap perubahan amount sebagai
      -- harga awal baru. Cukup ubah kolom diskon; trigger menghitung amount dari amount_original.
      UPDATE daily_recaps d
      SET discount_type = o.payload ->> 'discount_type',
          discount_value = (o.payload ->> 'discount_value')::numeric,
          discount_label = o.payload ->> 'discount_label',
          updated_at = now()
      WHERE d.id = o.recap_id AND d.invoice_created_at IS NOT NULL AND d.amount_original IS NOT NULL;
    ELSIF o.kind = 'vitals_edit' THEN
      v := o.payload -> 'vitals';
      UPDATE recap_vital_signs
      SET systolic = NULLIF(v ->> 'systolic', '')::integer,
          diastolic = NULLIF(v ->> 'diastolic', '')::integer,
          pulse = NULLIF(v ->> 'pulse', '')::integer,
          spo2 = NULLIF(v ->> 'spo2', '')::numeric,
          respiration = NULLIF(v ->> 'respiration', '')::integer,
          temperature = NULLIF(v ->> 'temperature', '')::numeric,
          weight = NULLIF(v ->> 'weight', '')::numeric,
          height = NULLIF(v ->> 'height', '')::numeric,
          notes = NULLIF(btrim(COALESCE(v ->> 'notes', '')), ''),
          updated_at = now()
      WHERE recap_id = o.recap_id AND clinic_id = o.clinic_id;
    ELSIF o.kind = 'recap_delete' THEN
      PERFORM set_config('app.invoice_delete_override', 'on', true);
      SELECT appointment_id INTO v_appt FROM daily_recaps WHERE id = o.recap_id AND clinic_id = o.clinic_id;
      DELETE FROM daily_recaps WHERE id = o.recap_id AND clinic_id = o.clinic_id;
      IF v_appt IS NOT NULL THEN
        DELETE FROM appointments WHERE id = v_appt AND clinic_id = o.clinic_id;
      END IF;
      PERFORM set_config('app.invoice_delete_override', 'off', true);
    ELSIF o.kind = 'package_change' THEN
      PERFORM package_change_apply(o.recap_id, o.clinic_id, o.payload ->> 'package_label');
    ELSIF o.kind = 'package_release' THEN
      PERFORM package_release_apply(o.recap_id, o.clinic_id);
    ELSIF o.kind = 'recovery_outside_package' THEN
      PERFORM recovery_outside_package_apply(
        o.recap_id,
        COALESCE((o.payload ->> 'outside')::boolean, true),
        o.reason,
        NULLIF(o.payload -> 'diagnosis', 'null'::jsonb),
        v_user,
        true
      );
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
$function$;
