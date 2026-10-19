-- Pengajuan "Ubah diskon" untuk sesi yang invoicenya sudah terbit (nominal & diskon terkunci).
-- Admin mengajukan {discount_type, discount_value, discount_label} + alasan; setelah owner menyetujui,
-- diskon dan nominal akhir dihitung dari amount_original (rumus sama dengan trg_zz_soap_first_final).

ALTER TABLE public.soap_overrides DROP CONSTRAINT IF EXISTS soap_overrides_kind_check;
ALTER TABLE public.soap_overrides ADD CONSTRAINT soap_overrides_kind_check
  CHECK (kind IN ('payment_unlock', 'incentive_restore', 'homecare_discount', 'xtratime', 'package_extend', 'amount_adjust', 'manual_discount', 'vitals_edit', 'recovery_outside_package', 'discount_adjust'));

CREATE OR REPLACE FUNCTION public.soap_first_request_override(p_kind text, p_recap_id uuid, p_reason text, p_payload jsonb DEFAULT '{}'::jsonb, p_package_id uuid DEFAULT NULL::uuid)
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
  v_label text;
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_old jsonb;
BEGIN
  IF v_role IS NULL OR NOT (
       v_role IN ('owner', 'super_admin', 'admin', 'clinic_admin')
       OR (v_role = 'therapist' AND p_kind = 'recovery_outside_package')
     ) THEN
    RAISE EXCEPTION 'Anda tidak berhak mengajukan pengecualian.';
  END IF;
  IF p_kind NOT IN ('payment_unlock', 'incentive_restore', 'homecare_discount', 'xtratime', 'package_extend', 'amount_adjust', 'manual_discount', 'vitals_edit', 'recovery_outside_package', 'discount_adjust') THEN
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
    IF p_kind = 'manual_discount' AND (
         COALESCE(p_payload ->> 'discount_type', '') NOT IN ('nominal', 'percentage')
         OR COALESCE(NULLIF(p_payload ->> 'discount_value', '')::numeric, 0) <= 0
         OR (p_payload ->> 'discount_type' = 'percentage' AND (p_payload ->> 'discount_value')::numeric > 100)
       ) THEN
      RAISE EXCEPTION 'Jenis dan nilai diskon manual wajib diisi dengan benar.';
    END IF;
    IF p_kind = 'discount_adjust' THEN
      IF COALESCE(p_payload ->> 'discount_type', '') NOT IN ('nominal', 'percentage')
         OR COALESCE(NULLIF(p_payload ->> 'discount_value', '')::numeric, 0) <= 0
         OR (p_payload ->> 'discount_type' = 'percentage' AND (p_payload ->> 'discount_value')::numeric > 100)
         OR char_length(btrim(COALESCE(p_payload ->> 'discount_label', ''))) = 0 THEN
        RAISE EXCEPTION 'Jenis, nilai, dan nama diskon wajib diisi dengan benar.';
      END IF;
      SELECT jsonb_build_object(
               'discount_type', p_payload ->> 'discount_type',
               'discount_value', (p_payload ->> 'discount_value')::numeric,
               'discount_label', btrim(p_payload ->> 'discount_label'),
               'old_discount_type', d.discount_type,
               'old_discount_value', d.discount_value,
               'old_discount_label', d.discount_label,
               'old_amount', d.amount)
      INTO v_payload
      FROM daily_recaps d
      WHERE d.id = p_recap_id AND d.invoice_created_at IS NOT NULL AND d.amount_original IS NOT NULL;
      IF v_payload IS NULL THEN
        RAISE EXCEPTION 'Perubahan diskon hanya untuk sesi yang invoicenya sudah terbit.';
      END IF;
    END IF;
    IF p_kind = 'recovery_outside_package' THEN
      IF jsonb_typeof(p_payload -> 'outside') IS DISTINCT FROM 'boolean' THEN
        RAISE EXCEPTION 'Pilihan di luar paket / kembali ke paket wajib diisi.';
      END IF;
      v_payload := jsonb_build_object('outside', p_payload -> 'outside');
      IF jsonb_typeof(p_payload -> 'diagnosis') = 'array' THEN
        v_payload := v_payload || jsonb_build_object('diagnosis', p_payload -> 'diagnosis');
      END IF;
    END IF;
    IF p_kind = 'vitals_edit' THEN
      IF jsonb_typeof(p_payload -> 'vitals') IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'Data tanda vital baru wajib diisi.';
      END IF;
      SELECT to_jsonb(r) - 'id' - 'clinic_id' - 'recap_id' - 'patient_id' - 'created_at' - 'updated_at' INTO v_old
      FROM recap_vital_signs r WHERE r.recap_id = p_recap_id;
      IF v_old IS NULL THEN
        RAISE EXCEPTION 'Tanda vital belum pernah diisi untuk recap ini.';
      END IF;
      v_payload := jsonb_build_object('vitals', p_payload -> 'vitals', 'old', v_old);
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
            v_payload, btrim(p_reason), v_user, v_name)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Sudah ada pengajuan yang menunggu persetujuan untuk hal yang sama.';
  END;

  v_label := CASE p_kind
    WHEN 'payment_unlock' THEN 'Buka kunci pembayaran'
    WHEN 'incentive_restore' THEN 'Pulihkan insentif terapis'
    WHEN 'homecare_discount' THEN 'Diskon homecare'
    WHEN 'xtratime' THEN 'Tandai Xtratime'
    WHEN 'manual_discount' THEN 'Diskon manual'
    WHEN 'vitals_edit' THEN 'Ubah tanda vital'
    WHEN 'package_extend' THEN 'Perpanjang masa aktif paket'
    WHEN 'recovery_outside_package' THEN 'Recovery di luar paket'
    WHEN 'discount_adjust' THEN 'Ubah diskon (invoice terbit)'
    ELSE 'Ubah nominal' END;

  IF v_role IN ('owner', 'super_admin') THEN
    PERFORM soap_first_decide_override(v_id, true, 'Diajukan dan disetujui oleh owner');
  ELSE
    PERFORM soap_first_notify_owners(v_clinic, 'Pengajuan pengecualian: ' || v_label,
      COALESCE(v_name, 'Admin') || ' - ' || btrim(p_reason), '/owner/overrides');
  END IF;

  RETURN v_id;
END;
$function$;

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
      UPDATE daily_recaps d
      SET discount_type = o.payload ->> 'discount_type',
          discount_value = (o.payload ->> 'discount_value')::numeric,
          discount_label = o.payload ->> 'discount_label',
          amount = CASE o.payload ->> 'discount_type'
            WHEN 'percentage' THEN GREATEST(round((d.amount_original - d.amount_original * LEAST((o.payload ->> 'discount_value')::numeric, 100) / 100) / 1000) * 1000, 0)
            ELSE GREATEST(round(d.amount_original - LEAST((o.payload ->> 'discount_value')::numeric, d.amount_original)), 0)
          END,
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
