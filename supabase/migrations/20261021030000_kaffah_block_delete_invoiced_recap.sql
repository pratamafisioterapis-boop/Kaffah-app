-- Khusus Kaffah Physiotherapy: sesi yang invoicenya sudah terbit tidak boleh dihapus
-- (daily recap maupun appointment-nya). Satu-satunya jalan: pengajuan override ke owner
-- (kind 'recap_delete'); owner sendiri boleh menghapus langsung. Proses sistem (tanpa login) tidak dibatasi.

ALTER TABLE public.soap_overrides DROP CONSTRAINT IF EXISTS soap_overrides_kind_check;
ALTER TABLE public.soap_overrides ADD CONSTRAINT soap_overrides_kind_check
  CHECK (kind IN ('payment_unlock', 'incentive_restore', 'homecare_discount', 'xtratime', 'package_extend', 'amount_adjust', 'manual_discount', 'vitals_edit', 'recovery_outside_package', 'discount_adjust', 'recap_delete'));

CREATE OR REPLACE FUNCTION public.guard_delete_invoiced_recap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
BEGIN
  IF OLD.clinic_id IS DISTINCT FROM 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid
     OR OLD.invoice_created_at IS NULL
     OR auth.uid() IS NULL
     OR COALESCE(current_setting('app.invoice_delete_override', true), '') = 'on' THEN
    RETURN OLD;
  END IF;
  v_role := get_my_role();
  IF v_role IN ('owner', 'super_admin') THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Recap ini sudah memiliki invoice sehingga tidak bisa dihapus. Ajukan pengecualian ke owner.'
    USING ERRCODE = 'P0001';
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_delete_invoiced_recap ON public.daily_recaps;
CREATE TRIGGER trg_guard_delete_invoiced_recap
  BEFORE DELETE ON public.daily_recaps
  FOR EACH ROW EXECUTE FUNCTION public.guard_delete_invoiced_recap();

CREATE OR REPLACE FUNCTION public.guard_delete_invoiced_appointment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.clinic_id IS DISTINCT FROM 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid
     OR auth.uid() IS NULL
     OR COALESCE(current_setting('app.invoice_delete_override', true), '') = 'on'
     OR get_my_role() IN ('owner', 'super_admin') THEN
    RETURN OLD;
  END IF;
  IF EXISTS (SELECT 1 FROM daily_recaps d WHERE d.appointment_id = OLD.id AND d.invoice_created_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Appointment ini sudah memiliki invoice sehingga tidak bisa dihapus. Ajukan pengecualian ke owner.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_delete_invoiced_appointment ON public.appointments;
CREATE TRIGGER trg_guard_delete_invoiced_appointment
  BEFORE DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.guard_delete_invoiced_appointment();

-- Pengajuan hapus recap (+ appointment terkait) yang invoicenya sudah terbit.
CREATE OR REPLACE FUNCTION public.request_invoiced_recap_delete(p_recap_id uuid, p_reason text)
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
  v_target_clinic uuid;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('owner', 'super_admin', 'admin', 'clinic_admin') THEN
    RAISE EXCEPTION 'Anda tidak berhak mengajukan pengecualian.';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Alasan wajib diisi (minimal 5 karakter).';
  END IF;
  SELECT d.clinic_id INTO v_target_clinic FROM daily_recaps d WHERE d.id = p_recap_id AND d.invoice_created_at IS NOT NULL;
  IF v_target_clinic IS DISTINCT FROM v_clinic THEN
    RAISE EXCEPTION 'Data tidak ditemukan.';
  END IF;
  SELECT u.full_name INTO v_name FROM users u WHERE u.id = v_user;

  BEGIN
    INSERT INTO soap_overrides (clinic_id, kind, recap_id, payload, reason, requested_by, requested_by_name)
    VALUES (v_clinic, 'recap_delete', p_recap_id, '{}'::jsonb, btrim(p_reason), v_user, v_name)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Sudah ada pengajuan yang menunggu persetujuan untuk hal yang sama.';
  END;

  IF v_role IN ('owner', 'super_admin') THEN
    PERFORM soap_first_decide_override(v_id, true, 'Diajukan dan disetujui oleh owner');
  ELSE
    PERFORM soap_first_notify_owners(v_clinic, 'Pengajuan pengecualian: Hapus recap (invoice terbit)',
      COALESCE(v_name, 'Admin') || ' - ' || btrim(p_reason), '/owner/overrides');
  END IF;
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.request_invoiced_recap_delete(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_invoiced_recap_delete(uuid, text) TO authenticated;

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
