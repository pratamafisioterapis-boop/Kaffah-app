-- Perbaikan discount_adjust: penerapan diskon tidak boleh menulis kolom amount.
-- Trigger lama apply_discount_to_amount menganggap perubahan amount sebagai amount_original baru,
-- sehingga diskon terpotong dua kali (220.000 - 100.000 = 120.000 lalu - 100.000 = 20.000).

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
