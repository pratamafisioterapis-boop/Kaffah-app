-- Pemegang kas utama (Admin 1) untuk setoran cash Kaffah.
--  * Ditandai owner di halaman "Cash Dipegang" (cash_ledger_config.custodian_user_id).
--  * Setoran admin -> admin hanya boleh ke pemegang kas utama yang AKTIF.
--  * Setoran ke keuangan hanya oleh pemegang kas utama (bila sudah ditandai).
--  * Admin nonaktif (users.is_active = false) tidak bisa jadi penerima; saldonya
--    tetap tampil ke owner agar uang yang masih dipegang tidak hilang dari pantauan.

ALTER TABLE public.cash_ledger_config
  ADD COLUMN IF NOT EXISTS custodian_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_cash_custodian(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := get_my_clinic_id();
BEGIN
  IF get_my_role() <> 'owner' THEN
    RAISE EXCEPTION 'Hanya owner yang dapat menandai pemegang kas utama' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cash_ledger_config WHERE clinic_id = v_clinic) THEN
    RAISE EXCEPTION 'Fitur setoran cash tidak aktif untuk klinik ini';
  END IF;
  IF p_user IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = p_user AND u.clinic_id = v_clinic AND u.role = 'admin' AND COALESCE(u.is_active, true)
  ) THEN
    RAISE EXCEPTION 'Pemegang kas utama harus akun admin yang aktif';
  END IF;
  UPDATE public.cash_ledger_config
     SET custodian_user_id = p_user, updated_at = now()
   WHERE clinic_id = v_clinic;
END;
$$;
REVOKE ALL ON FUNCTION public.set_cash_custodian(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_cash_custodian(uuid) TO authenticated;

-- Tambah kolom is_active & is_custodian -> tipe kembalian berubah, jadi drop dulu.
DROP FUNCTION IF EXISTS public.get_cash_holdings();
CREATE FUNCTION public.get_cash_holdings()
RETURNS TABLE (
  user_id          uuid,
  full_name        text,
  cash_received    numeric,
  handover_in      numeric,
  handover_out     numeric,
  to_finance       numeric,
  pending_in       numeric,
  balance          numeric,
  oldest_cash_date date,
  is_active        boolean,
  is_custodian     boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := get_my_clinic_id();
  v_start  date;
  v_cust   uuid;
BEGIN
  IF get_my_role() NOT IN ('admin', 'owner', 'super_admin') THEN
    RAISE EXCEPTION 'Tidak diizinkan' USING ERRCODE = '42501';
  END IF;

  SELECT c.start_date, c.custodian_user_id INTO v_start, v_cust
  FROM public.cash_ledger_config c WHERE c.clinic_id = v_clinic;
  IF v_start IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH recv AS (
    SELECT r.cashier_id AS uid,
           SUM(public.recap_cash_amount(r)) AS amt,
           MIN(COALESCE(r.revenue_date, r.recap_date)) FILTER (WHERE public.recap_cash_amount(r) > 0) AS first_date
    FROM public.daily_recaps r
    WHERE r.clinic_id = v_clinic
      AND COALESCE(r.revenue_date, r.recap_date) >= v_start
    GROUP BY r.cashier_id
  ),
  h_in AS (
    SELECT h.to_user_id AS uid,
           SUM(h.amount) FILTER (WHERE h.status = 'confirmed') AS confirmed,
           SUM(h.amount) FILTER (WHERE h.status = 'pending')   AS pending
    FROM public.cash_handovers h
    WHERE h.clinic_id = v_clinic AND h.to_type = 'admin'
    GROUP BY h.to_user_id
  ),
  h_out AS (
    SELECT h.from_user_id AS uid,
           SUM(h.amount) FILTER (WHERE h.status IN ('pending', 'confirmed')) AS total_out,
           SUM(h.amount) FILTER (WHERE h.status = 'confirmed' AND h.to_type = 'finance') AS fin
    FROM public.cash_handovers h
    WHERE h.clinic_id = v_clinic
    GROUP BY h.from_user_id
  ),
  ids AS (
    SELECT uid FROM recv UNION SELECT uid FROM h_in UNION SELECT uid FROM h_out
    UNION SELECT u.id FROM public.users u
          WHERE u.clinic_id = v_clinic AND u.role = 'admin' AND COALESCE(u.is_active, true)
  )
  SELECT i.uid,
         u.full_name,
         COALESCE(rv.amt, 0),
         COALESCE(hi.confirmed, 0),
         COALESCE(ho.total_out, 0),
         COALESCE(ho.fin, 0),
         COALESCE(hi.pending, 0),
         COALESCE(rv.amt, 0) + COALESCE(hi.confirmed, 0) - COALESCE(ho.total_out, 0),
         rv.first_date,
         COALESCE(u.is_active, true),
         (i.uid IS NOT NULL AND i.uid = v_cust)
  FROM ids i
  LEFT JOIN public.users u ON u.id = i.uid
  LEFT JOIN recv rv ON rv.uid IS NOT DISTINCT FROM i.uid
  LEFT JOIN h_in hi ON hi.uid = i.uid
  LEFT JOIN h_out ho ON ho.uid = i.uid
  WHERE get_my_role() <> 'admin' OR i.uid = auth.uid()
  ORDER BY u.full_name NULLS LAST;
END;
$$;
REVOKE ALL ON FUNCTION public.get_cash_holdings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cash_holdings() TO authenticated;

-- create_cash_handover: penerima harus pemegang kas utama aktif; ke keuangan
-- hanya pemegang kas utama (bila sudah ditandai).
CREATE OR REPLACE FUNCTION public.create_cash_handover(
  p_to_type  text,
  p_to_user  uuid,
  p_amount   numeric,
  p_date     date DEFAULT CURRENT_DATE,
  p_note     text DEFAULT NULL,
  p_proof    text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_clinic  uuid := get_my_clinic_id();
  v_cust    uuid;
  v_balance numeric;
  v_id      uuid;
BEGIN
  IF get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'Hanya admin yang dapat membuat setoran' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_uid AND COALESCE(u.is_active, true)) THEN
    RAISE EXCEPTION 'Akun tidak aktif' USING ERRCODE = '42501';
  END IF;
  SELECT c.custodian_user_id INTO v_cust FROM public.cash_ledger_config c WHERE c.clinic_id = v_clinic;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fitur setoran cash tidak aktif untuk klinik ini';
  END IF;
  -- pemegang kas utama yang sudah nonaktif dianggap belum ditandai (jangan mengunci admin lain)
  IF v_cust IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_cust AND COALESCE(u.is_active, true)) THEN
    v_cust := NULL;
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal harus lebih dari 0';
  END IF;
  IF p_to_type NOT IN ('admin', 'finance') THEN
    RAISE EXCEPTION 'Tujuan setoran tidak valid';
  END IF;
  IF p_proof IS NULL OR btrim(p_proof) = '' THEN
    RAISE EXCEPTION 'Foto bukti wajib untuk setiap setoran';
  END IF;
  IF split_part(p_proof, '/', 1) <> v_clinic::text THEN
    RAISE EXCEPTION 'Path bukti tidak valid';
  END IF;

  IF p_to_type = 'admin' THEN
    IF p_to_user IS NULL OR p_to_user = v_uid THEN
      RAISE EXCEPTION 'Pilih admin penerima (bukan diri sendiri)';
    END IF;
    IF v_cust IS NOT NULL AND p_to_user <> v_cust THEN
      RAISE EXCEPTION 'Setoran antar admin hanya ke pemegang kas utama';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = p_to_user AND u.clinic_id = v_clinic AND u.role = 'admin' AND COALESCE(u.is_active, true)
    ) THEN
      RAISE EXCEPTION 'Penerima bukan admin aktif klinik ini';
    END IF;
  ELSE
    p_to_user := NULL;
    IF v_cust IS NOT NULL AND v_uid <> v_cust THEN
      RAISE EXCEPTION 'Setoran ke keuangan dilakukan oleh pemegang kas utama';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('cash_handover:' || v_uid::text));

  SELECT g.balance INTO v_balance FROM public.get_cash_holdings() g WHERE g.user_id = v_uid;
  IF COALESCE(v_balance, 0) < p_amount THEN
    RAISE EXCEPTION 'Nominal melebihi cash yang Anda pegang (Rp %)', COALESCE(v_balance, 0);
  END IF;

  INSERT INTO public.cash_handovers
    (clinic_id, from_user_id, to_type, to_user_id, amount, handover_date, note, proof_path, status, confirmed_at)
  VALUES
    (v_clinic, v_uid, p_to_type, p_to_user, p_amount, COALESCE(p_date, CURRENT_DATE),
     NULLIF(btrim(COALESCE(p_note, '')), ''), NULLIF(btrim(COALESCE(p_proof, '')), ''),
     CASE WHEN p_to_type = 'finance' THEN 'confirmed' ELSE 'pending' END,
     CASE WHEN p_to_type = 'finance' THEN now() END)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_cash_handover(text, uuid, numeric, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_cash_handover(text, uuid, numeric, date, text, text) TO authenticated;
