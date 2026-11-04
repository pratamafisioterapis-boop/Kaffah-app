-- Kaffah: diskon owner bisa diatur sejak appointment (sebelum rekap/invoice ada).
-- Disimpan di appointments, lalu otomatis diterapkan ke rekap begitu invoice terbit.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS owner_discount_mode text,
  ADD COLUMN IF NOT EXISTS owner_discount_value numeric,
  ADD COLUMN IF NOT EXISTS owner_discount_by uuid,
  ADD COLUMN IF NOT EXISTS owner_discount_at timestamptz;

CREATE OR REPLACE FUNCTION public.owner_discount_resolve(p_mode text, p_value numeric, p_base numeric)
 RETURNS TABLE(d_type text, d_val numeric)
 LANGUAGE plpgsql IMMUTABLE
AS $function$
BEGIN
  IF p_mode = 'percentage' THEN
    d_type := 'percentage'; d_val := LEAST(p_value, 100);
  ELSIF p_mode = 'nominal' THEN
    d_type := 'nominal'; d_val := LEAST(round(p_value), p_base);
  ELSIF p_mode = 'final' THEN
    d_type := 'nominal'; d_val := GREATEST(p_base - round(p_value), 0);
  END IF;
  IF d_val IS NULL OR d_val <= 0 THEN d_type := NULL; d_val := 0; END IF;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_set_appointment_discount(
  p_appointment_id uuid, p_mode text, p_value numeric DEFAULT NULL
) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  c_kaffah constant uuid := 'bfdc3fd8-a052-4753-a5b7-229930b3237a';
  v_role text := get_my_role();
  r daily_recaps;
  a appointments;
  v_base numeric;
  v_type text; v_val numeric;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('owner', 'super_admin') THEN
    RAISE EXCEPTION 'Hanya owner yang dapat memberi diskon.';
  END IF;
  IF get_my_clinic_id() IS DISTINCT FROM c_kaffah THEN
    RAISE EXCEPTION 'Fitur ini khusus Kaffah Physiotherapy.';
  END IF;
  SELECT * INTO a FROM appointments WHERE id = p_appointment_id AND clinic_id = c_kaffah FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment tidak ditemukan.'; END IF;

  IF p_mode = 'percentage' AND (p_value IS NULL OR p_value <= 0 OR p_value > 100) THEN
    RAISE EXCEPTION 'Persen diskon harus antara 0 dan 100.';
  ELSIF p_mode IN ('nominal') AND (p_value IS NULL OR p_value <= 0) THEN
    RAISE EXCEPTION 'Diskon rupiah harus lebih dari 0.';
  ELSIF p_mode = 'final' AND (p_value IS NULL OR p_value < 0) THEN
    RAISE EXCEPTION 'Nominal yang dibayar tidak valid.';
  ELSIF p_mode NOT IN ('percentage', 'nominal', 'final', 'clear') THEN
    RAISE EXCEPTION 'Mode diskon tidak dikenal.';
  END IF;

  SELECT * INTO r FROM daily_recaps
  WHERE appointment_id = p_appointment_id AND clinic_id = c_kaffah
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

  IF FOUND AND r.invoice_created_at IS NOT NULL THEN
    -- Invoice sudah ada: terapkan langsung.
    IF r.special_type = 'free' OR r.payment_method = 'Package' OR r.referral_reward_id IS NOT NULL THEN
      RAISE EXCEPTION 'Tagihan ini (free/paket/reward referral) tidak dapat diberi diskon manual.';
    END IF;
    v_base := COALESCE(r.amount_original, r.amount, 0);
    IF v_base <= 0 THEN RAISE EXCEPTION 'Tagihan bernilai Rp 0, tidak ada yang bisa didiskon.'; END IF;
    IF p_mode = 'final' AND p_value >= v_base THEN
      RAISE EXCEPTION 'Nominal yang dibayar harus kurang dari tagihan (Rp %).', v_base;
    END IF;
    IF p_mode = 'nominal' AND p_value > v_base THEN
      RAISE EXCEPTION 'Diskon tidak boleh melebihi tagihan.';
    END IF;
    IF p_mode = 'clear' THEN v_type := NULL; v_val := 0;
    ELSE SELECT d_type, d_val INTO v_type, v_val FROM owner_discount_resolve(p_mode, p_value, v_base); END IF;

    PERFORM set_config('app.soap_first_rpc', 'on', true);
    UPDATE daily_recaps
    SET discount_type = v_type, discount_value = COALESCE(v_val, 0),
        discount_label = CASE WHEN v_type IS NULL THEN NULL ELSE 'Diskon Owner' END,
        updated_at = now()
    WHERE id = r.id;
    PERFORM set_config('app.soap_first_rpc', 'off', true);
    -- sudah diterapkan: tidak perlu menunggu
    UPDATE appointments SET owner_discount_mode = NULL, owner_discount_value = NULL,
      owner_discount_by = NULL, owner_discount_at = NULL WHERE id = a.id;
    RETURN jsonb_build_object('applied', true);
  END IF;

  -- Belum ada invoice: simpan dulu, diterapkan otomatis saat invoice terbit.
  IF p_mode = 'clear' THEN
    UPDATE appointments SET owner_discount_mode = NULL, owner_discount_value = NULL,
      owner_discount_by = NULL, owner_discount_at = NULL WHERE id = a.id;
  ELSE
    UPDATE appointments SET owner_discount_mode = p_mode, owner_discount_value = p_value,
      owner_discount_by = auth.uid(), owner_discount_at = now() WHERE id = a.id;
  END IF;
  RETURN jsonb_build_object('applied', false);
END;
$function$;

-- Terapkan diskon tertunda begitu invoice terbit.
CREATE OR REPLACE FUNCTION public.trg_apply_owner_discount_on_invoice()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  a appointments;
  v_base numeric;
  v_type text; v_val numeric;
BEGIN
  IF NEW.invoice_created_at IS NULL OR NEW.appointment_id IS NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND OLD.invoice_created_at IS NOT NULL THEN RETURN NULL; END IF;
  IF NEW.special_type = 'free' OR NEW.payment_method = 'Package' OR NEW.referral_reward_id IS NOT NULL THEN RETURN NULL; END IF;

  SELECT * INTO a FROM appointments
  WHERE id = NEW.appointment_id AND owner_discount_mode IS NOT NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_base := COALESCE(NEW.amount_original, NEW.amount, 0);
  IF v_base <= 0 THEN RETURN NULL; END IF;
  SELECT d_type, d_val INTO v_type, v_val FROM owner_discount_resolve(a.owner_discount_mode, a.owner_discount_value, v_base);
  IF v_type IS NULL THEN RETURN NULL; END IF;

  PERFORM set_config('app.soap_first_rpc', 'on', true);
  UPDATE daily_recaps
  SET discount_type = v_type, discount_value = v_val, discount_label = 'Diskon Owner', updated_at = now()
  WHERE id = NEW.id;
  PERFORM set_config('app.soap_first_rpc', 'off', true);

  UPDATE appointments SET owner_discount_mode = NULL, owner_discount_value = NULL,
    owner_discount_by = NULL, owner_discount_at = NULL WHERE id = a.id;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS zz_apply_owner_discount_on_invoice ON public.daily_recaps;
CREATE TRIGGER zz_apply_owner_discount_on_invoice
  AFTER INSERT OR UPDATE OF invoice_created_at ON public.daily_recaps
  FOR EACH ROW EXECUTE FUNCTION public.trg_apply_owner_discount_on_invoice();
