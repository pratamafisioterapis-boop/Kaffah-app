-- Tampilkan nama pasien yang direkomendasikan pada hasil lookup kode reward referral.
CREATE OR REPLACE FUNCTION public.lookup_referral_reward(p_code text, p_patient_id uuid, p_recap_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  r referral_rewards%ROWTYPE;
  v_reason text;
BEGIN
  SELECT * INTO r
  FROM referral_rewards
  WHERE upper(code) = upper(trim(p_code))
    AND (get_my_role() = 'super_admin' OR clinic_id = get_my_clinic_id())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Kode reward tidak ditemukan.');
  END IF;

  IF r.referrer_patient_id IS DISTINCT FROM p_patient_id THEN
    v_reason := 'Kode reward ini bukan milik pasien yang dipilih.';
  ELSIF r.status = 'void' THEN
    v_reason := 'Kode reward sudah tidak berlaku.';
  ELSIF r.status = 'claimed' AND r.claimed_recap_id IS DISTINCT FROM p_recap_id THEN
    v_reason := 'Kode reward sudah pernah dipakai.';
  ELSIF r.status <> 'claimed' AND r.expires_at < (NOW() AT TIME ZONE 'Asia/Makassar')::date THEN
    v_reason := 'Kode reward sudah kedaluwarsa (berlaku hingga ' || to_char(r.expires_at, 'DD-MM-YYYY') || ').';
  END IF;

  RETURN jsonb_build_object(
    'valid', v_reason IS NULL,
    'reason', v_reason,
    'id', r.id,
    'code', r.code,
    'discount_value_type', r.discount_value_type,
    'discount_value', r.discount_value,
    'discount_label', COALESCE(r.discount_label, 'Referral Reward'),
    'expires_at', r.expires_at,
    'referred_name', (SELECT full_name FROM patients WHERE id = r.referred_patient_id)
  );
END;
$function$;
