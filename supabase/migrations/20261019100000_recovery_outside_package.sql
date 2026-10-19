-- ---------------------------------------------------------------------------
-- Recovery (DOMS) di luar paket - KHUSUS klinik Kaffah.
-- Pasien yang masih punya sisa sesi paket boleh mengambil sesi Recovery tanpa
-- memotong kuota paketnya. Terapis menandainya dari SOAP (diagnosa DOMS);
-- recap dilepas dari paket, ditandai bypass_package_id, lalu dibayar sebagai
-- kunjungan Recovery biasa (SOAP dulu, baru bayar).
--
-- Aturan:
--  * Hanya sesi lanjutan paket (nominal 0). Sesi pembelian paket tidak boleh.
--  * Paket berlabel " RU" sudah khusus recovery -> tidak berlaku.
--  * Sebelum invoice: terapis recap itu atau owner dapat memilih / membatalkan.
--  * Setelah invoice: harus pengajuan override 'recovery_outside_package'
--    yang disetujui owner.
-- ---------------------------------------------------------------------------

ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS bypass_package_id uuid REFERENCES public.package_tracking(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bypass_reason text,
  ADD COLUMN IF NOT EXISTS bypass_at timestamptz,
  ADD COLUMN IF NOT EXISTS bypass_by uuid;

CREATE INDEX IF NOT EXISTS daily_recaps_bypass_package_idx
  ON public.daily_recaps (bypass_package_id) WHERE bypass_package_id IS NOT NULL;

-- Penjaga: trigger auto-assign paket (auto_assign_package_on_update,
-- auto_assign_shared_package_on_recap, dll.) tidak boleh menautkan ulang recap
-- yang sudah ditandai di luar paket. Nama "zz_" agar jalan paling akhir.
CREATE OR REPLACE FUNCTION public.trg_zz_keep_package_bypass()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW.bypass_package_id IS NOT NULL THEN
    IF NEW.package_tracking_id IS NOT NULL THEN
      NEW.package_tracking_id := NULL;
      NEW.amount_package := NULL;
      NEW.session_info := NULL;
    END IF;
    IF NEW.payment_method = 'Package' THEN
      NEW.payment_method := OLD.payment_method;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS zz_keep_package_bypass ON public.daily_recaps;
CREATE TRIGGER zz_keep_package_bypass
  BEFORE UPDATE ON public.daily_recaps
  FOR EACH ROW EXECUTE FUNCTION public.trg_zz_keep_package_bypass();

-- ---------------------------------------------------------------------------
-- Inti: lepas / kembalikan tautan paket. Tanpa pengecekan peran (dipanggil
-- dari RPC yang sudah memeriksa, atau dari persetujuan override owner).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recovery_outside_package_apply(
  p_recap_id uuid, p_outside boolean, p_reason text, p_diagnosis jsonb, p_by uuid, p_allow_paid boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  c_kaffah constant uuid := 'bfdc3fd8-a052-4753-a5b7-229930b3237a';
  r daily_recaps;
  v_pkg package_tracking;
  v_diag jsonb;
  v_used integer;
  v_prev text := COALESCE(current_setting('app.soap_first_rpc', true), '');
  v_paid boolean;
BEGIN
  SELECT * INTO r FROM daily_recaps WHERE id = p_recap_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recap tidak ditemukan.';
  END IF;
  IF r.clinic_id IS DISTINCT FROM c_kaffah THEN
    RAISE EXCEPTION 'Fitur ini hanya tersedia untuk klinik Kaffah.';
  END IF;

  IF p_outside THEN
    IF r.package_tracking_id IS NULL THEN
      RAISE EXCEPTION 'Sesi ini tidak memakai kuota paket.';
    END IF;
    IF COALESCE(r.amount_original, r.amount, 0) <> 0 THEN
      RAISE EXCEPTION 'Sesi pembelian paket tidak dapat diambil di luar paket.';
    END IF;
    SELECT * INTO v_pkg FROM package_tracking WHERE id = r.package_tracking_id;
    IF v_pkg.package_name ILIKE '% RU' THEN
      RAISE EXCEPTION 'Paket RU sudah khusus recovery, tidak perlu dikeluarkan dari paket.';
    END IF;

    v_diag := COALESCE(p_diagnosis, r.diagnosis);
    IF NOT EXISTS (
      SELECT 1 FROM operational_options o
      WHERE o.clinic_id = r.clinic_id AND o.category = 'diagnosa'
        AND o.id::text = ANY (soap_first_diag_ids(v_diag))
        AND o.label ILIKE 'doms%'
    ) THEN
      RAISE EXCEPTION 'Recovery di luar paket hanya untuk diagnosa DOMS.';
    END IF;

    PERFORM set_config('app.soap_first_rpc', 'on', true);
    UPDATE daily_recaps
    SET diagnosis = v_diag,
        bypass_package_id = r.package_tracking_id,
        bypass_reason = p_reason,
        bypass_at = now(),
        bypass_by = p_by,
        package_tracking_id = NULL,
        amount_package = NULL,
        session_info = NULL,
        package_type = 'REGULER',
        payment_method = NULL,
        updated_at = now()
    WHERE id = p_recap_id;
    PERFORM set_config('app.soap_first_rpc', v_prev, true);
  ELSE
    IF r.bypass_package_id IS NULL THEN
      RAISE EXCEPTION 'Sesi ini tidak ditandai di luar paket.';
    END IF;
    SELECT * INTO v_pkg FROM package_tracking WHERE id = r.bypass_package_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Paket asal sudah tidak ada.';
    END IF;
    IF v_pkg.status NOT IN ('aktif', 'diperpanjang')
       OR r.recap_date < v_pkg.start_date
       OR r.recap_date > COALESCE(v_pkg.extended_until, v_pkg.end_date) THEN
      RAISE EXCEPTION 'Paket asal sudah tidak aktif pada tanggal sesi ini.';
    END IF;
    SELECT COUNT(*) INTO v_used FROM daily_recaps WHERE package_tracking_id = v_pkg.id;
    IF v_used >= v_pkg.total_sessions THEN
      RAISE EXCEPTION 'Sisa sesi paket sudah habis, sesi tidak dapat dikembalikan.';
    END IF;

    v_paid := r.invoice_created_at IS NOT NULL
      OR COALESCE(r.amount, 0) > 0
      OR (r.payment_method IS NOT NULL AND r.payment_method <> 'Package');
    IF v_paid AND NOT p_allow_paid THEN
      RAISE EXCEPTION 'Invoice sudah terbit. Ajukan pengecualian ke owner.';
    END IF;

    PERFORM set_config('app.soap_first_rpc', 'on', true);
    IF v_paid THEN
      DELETE FROM daily_recap_payment_splits WHERE recap_id = p_recap_id;
    END IF;
    UPDATE daily_recaps
    SET package_tracking_id = v_pkg.id,
        package_type = v_pkg.package_name,
        payment_method = 'Package',
        amount = 0,
        amount_original = 0,
        discount_type = NULL,
        discount_value = 0,
        discount_label = NULL,
        invoice_created_at = NULL,
        bypass_package_id = NULL,
        bypass_reason = NULL,
        bypass_at = NULL,
        bypass_by = NULL,
        updated_at = now()
    WHERE id = p_recap_id;
    PERFORM set_config('app.soap_first_rpc', v_prev, true);
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.recovery_outside_package_apply(uuid, boolean, text, jsonb, uuid, boolean) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC untuk UI (terapis recap tsb / owner).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_recovery_outside_package(
  p_recap_id uuid, p_outside boolean, p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  c_kaffah constant uuid := 'bfdc3fd8-a052-4753-a5b7-229930b3237a';
  v_role text := get_my_role();
  v_user uuid := auth.uid();
  r daily_recaps;
  v_owner boolean;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  IF get_my_clinic_id() IS DISTINCT FROM c_kaffah THEN
    RAISE EXCEPTION 'Fitur ini hanya tersedia untuk klinik Kaffah.';
  END IF;
  SELECT * INTO r FROM daily_recaps WHERE id = p_recap_id;
  IF NOT FOUND OR r.clinic_id IS DISTINCT FROM c_kaffah THEN
    RAISE EXCEPTION 'Recap tidak ditemukan.';
  END IF;

  v_owner := COALESCE(v_role IN ('owner', 'super_admin'), false);
  IF NOT v_owner THEN
    IF v_role IS DISTINCT FROM 'therapist' OR NOT EXISTS (
      SELECT 1 FROM physiotherapists p WHERE p.user_id = v_user AND p.id = r.therapist_id
    ) THEN
      RAISE EXCEPTION 'Hanya terapis sesi ini atau owner yang dapat mengubahnya.';
    END IF;
    IF r.invoice_created_at IS NOT NULL THEN
      RAISE EXCEPTION 'Invoice sudah terbit. Ajukan pengecualian ke owner.';
    END IF;
  END IF;

  IF NOT p_outside AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Alasan pembatalan wajib diisi.';
  END IF;

  PERFORM recovery_outside_package_apply(
    p_recap_id, p_outside,
    COALESCE(v_reason, 'Recovery (DOMS) di luar paket'),
    NULL, v_user, v_owner
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.set_recovery_outside_package(uuid, boolean, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Override owner untuk perubahan setelah invoice terbit.
-- Payload: {"outside": true|false, "diagnosis": ["<uuid>", ...]} (diagnosa opsional).
-- ---------------------------------------------------------------------------
ALTER TABLE public.soap_overrides DROP CONSTRAINT IF EXISTS soap_overrides_kind_check;
ALTER TABLE public.soap_overrides ADD CONSTRAINT soap_overrides_kind_check
  CHECK (kind IN ('payment_unlock', 'incentive_restore', 'homecare_discount', 'xtratime', 'package_extend', 'amount_adjust', 'manual_discount', 'vitals_edit', 'recovery_outside_package'));

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
  IF p_kind NOT IN ('payment_unlock', 'incentive_restore', 'homecare_discount', 'xtratime', 'package_extend', 'amount_adjust', 'manual_discount', 'vitals_edit', 'recovery_outside_package') THEN
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
