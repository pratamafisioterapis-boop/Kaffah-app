-- ---------------------------------------------------------------------------
-- Kas kecil (modal Rp 300rb dari keuangan) khusus Kaffah.
--
-- Aturan bisnis:
--  * Pembelian/pengeluaran cash bisa ditandai "dibayar dari kas kecil"
--    (admin_expenses.paid_from_petty) oleh Admin 1 maupun Admin 2.
--  * Sisa kas kecil = modal awal - pembelian dari kas kecil + isi ulang.
--  * Saat pemegang kas utama setor pendapatan ke keuangan, pembelian tadi
--    "dipotong dari pendapatan": sistem mengisi ulang kas kecil dari cash
--    pendapatan (cash_handovers.petty_replenish) sampai kembali ke plafon,
--    dan nominal yang disetor = pendapatan - isi ulang. Kas kecil kembali Rp 300rb.
--  * Laporan akuntansi tidak berubah: pendapatan tetap bruto, pengeluaran
--    tetap tercatat di admin_expenses.
-- ---------------------------------------------------------------------------

ALTER TABLE public.cash_ledger_config
  ADD COLUMN IF NOT EXISTS petty_plafon  numeric NOT NULL DEFAULT 0 CHECK (petty_plafon >= 0),
  ADD COLUMN IF NOT EXISTS petty_opening numeric NOT NULL DEFAULT 0 CHECK (petty_opening >= 0);

UPDATE public.cash_ledger_config
   SET petty_plafon = 300000, petty_opening = 300000, updated_at = now()
 WHERE clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
   AND petty_plafon = 0 AND petty_opening = 0;

ALTER TABLE public.admin_expenses
  ADD COLUMN IF NOT EXISTS paid_from_petty boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_admin_expenses_petty
  ON public.admin_expenses (clinic_id, transaction_date DESC) WHERE paid_from_petty;

ALTER TABLE public.cash_handovers
  ADD COLUMN IF NOT EXISTS petty_replenish numeric NOT NULL DEFAULT 0;
ALTER TABLE public.cash_handovers DROP CONSTRAINT IF EXISTS cash_handovers_amount_check;
ALTER TABLE public.cash_handovers DROP CONSTRAINT IF EXISTS chk_cash_handover_amount_nonneg;
ALTER TABLE public.cash_handovers
  ADD CONSTRAINT chk_cash_handover_amount_nonneg CHECK (amount >= 0);
ALTER TABLE public.cash_handovers DROP CONSTRAINT IF EXISTS chk_cash_handover_petty;
ALTER TABLE public.cash_handovers
  ADD CONSTRAINT chk_cash_handover_petty CHECK (
    petty_replenish >= 0
    AND (petty_replenish = 0 OR to_type = 'finance')
    AND amount + petty_replenish > 0
  );

-- Ringkasan kas kecil sebuah klinik (internal).
CREATE OR REPLACE FUNCTION public._petty_summary(p_clinic uuid)
RETURNS TABLE (plafon numeric, opening numeric, spent numeric, replenished numeric, balance numeric, needed numeric)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.petty_plafon,
         c.petty_opening,
         s.spent,
         r.replenished,
         c.petty_opening - s.spent + r.replenished,
         GREATEST(0, c.petty_plafon - (c.petty_opening - s.spent + r.replenished))
  FROM public.cash_ledger_config c
  CROSS JOIN LATERAL (
    SELECT COALESCE(SUM(e.amount), 0) AS spent
    FROM public.admin_expenses e WHERE e.clinic_id = p_clinic AND e.paid_from_petty
  ) s
  CROSS JOIN LATERAL (
    SELECT COALESCE(SUM(h.petty_replenish), 0) AS replenished
    FROM public.cash_handovers h WHERE h.clinic_id = p_clinic AND h.status = 'confirmed'
  ) r
  WHERE c.clinic_id = p_clinic AND c.petty_plafon > 0;
$$;
REVOKE ALL ON FUNCTION public._petty_summary(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_petty_cash()
RETURNS TABLE (plafon numeric, opening numeric, spent numeric, replenished numeric, balance numeric, needed numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_my_role() NOT IN ('admin', 'owner', 'super_admin') THEN
    RAISE EXCEPTION 'Tidak diizinkan' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public._petty_summary(get_my_clinic_id());
END;
$$;
REVOKE ALL ON FUNCTION public.get_petty_cash() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_petty_cash() TO authenticated;

-- Saldo cash pendapatan per admin: setoran keluar kini termasuk isi ulang kas kecil.
CREATE OR REPLACE FUNCTION public.get_cash_holdings()
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
           SUM(h.amount + h.petty_replenish) FILTER (WHERE h.status IN ('pending', 'confirmed')) AS total_out,
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

-- Setoran dengan parameter isi ulang kas kecil (hanya untuk setoran ke keuangan).
DROP FUNCTION IF EXISTS public.create_cash_handover(text, uuid, numeric, date, text, text);
CREATE OR REPLACE FUNCTION public.create_cash_handover(
  p_to_type         text,
  p_to_user         uuid,
  p_amount          numeric,
  p_date            date DEFAULT CURRENT_DATE,
  p_note            text DEFAULT NULL,
  p_proof           text DEFAULT NULL,
  p_petty_replenish numeric DEFAULT 0
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
  v_repl    numeric := COALESCE(p_petty_replenish, 0);
  v_needed  numeric;
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
  IF v_cust IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_cust AND COALESCE(u.is_active, true)) THEN
    v_cust := NULL;
  END IF;
  IF p_amount IS NULL OR p_amount < 0 OR v_repl < 0 OR p_amount + v_repl <= 0 THEN
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
    IF v_repl > 0 THEN
      RAISE EXCEPTION 'Isi ulang kas kecil hanya pada setoran ke keuangan';
    END IF;
    IF p_amount <= 0 THEN
      RAISE EXCEPTION 'Nominal harus lebih dari 0';
    END IF;
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
  PERFORM pg_advisory_xact_lock(hashtext('petty_cash:' || v_clinic::text));

  IF v_repl > 0 THEN
    SELECT s.needed INTO v_needed FROM public._petty_summary(v_clinic) s;
    IF COALESCE(v_needed, 0) < v_repl THEN
      RAISE EXCEPTION 'Isi ulang kas kecil melebihi yang dibutuhkan (Rp %)', COALESCE(v_needed, 0);
    END IF;
  END IF;

  SELECT g.balance INTO v_balance FROM public.get_cash_holdings() g WHERE g.user_id = v_uid;
  IF COALESCE(v_balance, 0) < p_amount + v_repl THEN
    RAISE EXCEPTION 'Total (setoran + isi ulang kas kecil) melebihi cash pendapatan yang Anda pegang (Rp %)', COALESCE(v_balance, 0);
  END IF;

  INSERT INTO public.cash_handovers
    (clinic_id, from_user_id, to_type, to_user_id, amount, petty_replenish, handover_date, note, proof_path, status, confirmed_at)
  VALUES
    (v_clinic, v_uid, p_to_type, p_to_user, p_amount, v_repl, COALESCE(p_date, CURRENT_DATE),
     NULLIF(btrim(COALESCE(p_note, '')), ''), NULLIF(btrim(COALESCE(p_proof, '')), ''),
     CASE WHEN p_to_type = 'finance' THEN 'confirmed' ELSE 'pending' END,
     CASE WHEN p_to_type = 'finance' THEN now() END)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_cash_handover(text, uuid, numeric, date, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_cash_handover(text, uuid, numeric, date, text, text, numeric) TO authenticated;
