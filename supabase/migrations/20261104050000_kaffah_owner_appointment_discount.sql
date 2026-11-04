-- Kaffah: owner memberi diskon langsung dari kartu appointment (persen, rupiah, atau nominal yang dibayar).
-- Hanya mengubah kolom diskon; trigger apply_discount_to_amount menghitung ulang amount dari amount_original.

CREATE OR REPLACE FUNCTION public.owner_set_appointment_discount(
  p_appointment_id uuid,
  p_mode text,            -- 'percentage' | 'nominal' | 'final' | 'clear'
  p_value numeric DEFAULT NULL
) RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c_kaffah constant uuid := 'bfdc3fd8-a052-4753-a5b7-229930b3237a';
  v_role text := get_my_role();
  r daily_recaps;
  v_base numeric;
  v_type text;
  v_val numeric;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('owner', 'super_admin') THEN
    RAISE EXCEPTION 'Hanya owner yang dapat memberi diskon.';
  END IF;
  IF get_my_clinic_id() IS DISTINCT FROM c_kaffah THEN
    RAISE EXCEPTION 'Fitur ini khusus Kaffah Physiotherapy.';
  END IF;

  SELECT * INTO r FROM daily_recaps
  WHERE appointment_id = p_appointment_id AND clinic_id = c_kaffah
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tagihan belum terbentuk. Diskon bisa diberikan setelah terapis mengisi rekap dan invoice terbit.';
  END IF;
  IF r.invoice_created_at IS NULL THEN
    RAISE EXCEPTION 'Invoice belum terbit, tagihan belum final.';
  END IF;
  IF r.special_type = 'free' OR r.payment_method = 'Package' OR r.referral_reward_id IS NOT NULL THEN
    RAISE EXCEPTION 'Tagihan ini (free/paket/reward referral) tidak dapat diberi diskon manual.';
  END IF;
  v_base := COALESCE(r.amount_original, r.amount, 0);
  IF v_base <= 0 THEN
    RAISE EXCEPTION 'Tagihan bernilai Rp 0, tidak ada yang bisa didiskon.';
  END IF;

  IF p_mode = 'clear' THEN
    v_type := NULL; v_val := 0;
  ELSIF p_mode = 'percentage' THEN
    IF p_value IS NULL OR p_value <= 0 OR p_value > 100 THEN
      RAISE EXCEPTION 'Persen diskon harus antara 0 dan 100.';
    END IF;
    v_type := 'percentage'; v_val := p_value;
  ELSIF p_mode = 'nominal' THEN
    IF p_value IS NULL OR p_value <= 0 OR p_value > v_base THEN
      RAISE EXCEPTION 'Diskon rupiah harus lebih dari 0 dan tidak melebihi tagihan.';
    END IF;
    v_type := 'nominal'; v_val := round(p_value);
  ELSIF p_mode = 'final' THEN
    IF p_value IS NULL OR p_value < 0 OR p_value >= v_base THEN
      RAISE EXCEPTION 'Nominal yang dibayar harus kurang dari tagihan (Rp %).', v_base;
    END IF;
    v_type := 'nominal'; v_val := v_base - round(p_value);
  ELSE
    RAISE EXCEPTION 'Mode diskon tidak dikenal.';
  END IF;

  PERFORM set_config('app.soap_first_rpc', 'on', true);
  UPDATE daily_recaps
  SET discount_type = v_type,
      discount_value = v_val,
      discount_label = CASE WHEN v_type IS NULL THEN NULL ELSE 'Diskon Owner' END,
      updated_at = now()
  WHERE id = r.id;
  PERFORM set_config('app.soap_first_rpc', 'off', true);

  RETURN (SELECT jsonb_build_object('amount_original', amount_original, 'amount', amount,
            'discount_type', discount_type, 'discount_value', discount_value)
          FROM daily_recaps WHERE id = r.id);
END;
$function$;

REVOKE ALL ON FUNCTION public.owner_set_appointment_discount(uuid, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_set_appointment_discount(uuid, text, numeric) TO authenticated;
