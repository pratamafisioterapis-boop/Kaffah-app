-- ---------------------------------------------------------------------------
-- Pelacakan uang cash yang dipegang admin (khusus Kaffah).
--
-- Alur: pasien bayar cash -> kasir (admin, daily_recaps.cashier_id)
--       -> admin lain (Admin 2 -> Admin 1, 2 langkah: pending -> confirmed)
--       -> tim keuangan (dicatat + foto bukti, tanpa konfirmasi).
--
-- Saldo TIDAK disimpan sebagai angka, selalu dihitung dari catatan:
--   saldo = cash diterima sebagai kasir
--         + setoran masuk dari admin lain (confirmed)
--         - setoran keluar (pending + confirmed)
--
-- Cash tips terapis TIDAK dihitung: tips langsung diberikan ke terapis dan
-- tidak masuk ke keuangan. Cash dari recap = bagian terapi (split cash atau
-- seluruh nominal bila metode cash) + penjualan barang (mengikuti metode recap).
-- ---------------------------------------------------------------------------

-- Tanggal mulai pencatatan. Cash sebelum tanggal ini dianggap sudah beres
-- disetor, supaya saldo tidak dimulai dengan angka historis yang salah.
CREATE TABLE IF NOT EXISTS public.cash_ledger_config (
  clinic_id  uuid PRIMARY KEY,
  start_date date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cash_ledger_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.cash_ledger_config (clinic_id, start_date)
VALUES ('bfdc3fd8-a052-4753-a5b7-229930b3237a', DATE '2026-11-15')
ON CONFLICT (clinic_id) DO NOTHING;

DROP POLICY IF EXISTS cash_ledger_config_read ON public.cash_ledger_config;
CREATE POLICY cash_ledger_config_read ON public.cash_ledger_config
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'super_admin'
    OR (get_my_role() IN ('owner', 'admin') AND clinic_id = get_my_clinic_id())
  );

CREATE TABLE IF NOT EXISTS public.cash_handovers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     uuid NOT NULL,
  from_user_id  uuid NOT NULL REFERENCES public.users(id),
  to_type       text NOT NULL CHECK (to_type IN ('admin', 'finance')),
  to_user_id    uuid REFERENCES public.users(id),
  amount        numeric NOT NULL CHECK (amount > 0),
  handover_date date NOT NULL DEFAULT CURRENT_DATE,
  note          text,
  proof_path    text,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  confirmed_by  uuid REFERENCES public.users(id),
  confirmed_at  timestamptz,
  reject_reason text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_cash_handover_target CHECK (
    (to_type = 'admin'   AND to_user_id IS NOT NULL AND to_user_id <> from_user_id)
    OR (to_type = 'finance' AND to_user_id IS NULL)
  ),
  CONSTRAINT chk_cash_handover_proof CHECK (proof_path IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_cash_handovers_clinic_date ON public.cash_handovers (clinic_id, handover_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_handovers_from ON public.cash_handovers (from_user_id);
CREATE INDEX IF NOT EXISTS idx_cash_handovers_to ON public.cash_handovers (to_user_id) WHERE to_user_id IS NOT NULL;

ALTER TABLE public.cash_handovers ENABLE ROW LEVEL SECURITY;

-- Baca saja; semua perubahan lewat fungsi di bawah (SECURITY DEFINER) agar aturan
-- saldo & konfirmasi tidak bisa dilewati dari klien.
DROP POLICY IF EXISTS cash_handovers_read ON public.cash_handovers;
CREATE POLICY cash_handovers_read ON public.cash_handovers
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'super_admin'
    OR (get_my_role() IN ('owner', 'admin') AND clinic_id = get_my_clinic_id())
  );

-- Bagian cash sebuah recap yang masuk ke kasir (tanpa tips).
CREATE OR REPLACE FUNCTION public.recap_cash_amount(p_recap public.daily_recaps)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM public.daily_recap_payment_splits s WHERE s.recap_id = p_recap.id)
        THEN COALESCE((
          SELECT SUM(s.amount) FROM public.daily_recap_payment_splits s
          WHERE s.recap_id = p_recap.id
            AND lower(btrim(s.payment_method)) IN ('cash', 'tunai')
        ), 0)
      WHEN lower(btrim(COALESCE(p_recap.payment_method, ''))) IN ('cash', 'tunai')
        THEN COALESCE(p_recap.amount, 0)
      ELSE 0
    END
    + CASE
        WHEN lower(btrim(COALESCE(p_recap.payment_method, ''))) IN ('cash', 'tunai')
          THEN COALESCE(p_recap.goods_amount, 0)
        ELSE 0
      END;
$$;
REVOKE ALL ON FUNCTION public.recap_cash_amount(public.daily_recaps) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recap_cash_amount(public.daily_recaps) TO authenticated;

-- Ringkasan saldo cash per admin. user_id NULL = cash recap tanpa kasir tercatat.
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
  oldest_cash_date date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := get_my_clinic_id();
  v_start  date;
BEGIN
  IF get_my_role() NOT IN ('admin', 'owner', 'super_admin') THEN
    RAISE EXCEPTION 'Tidak diizinkan' USING ERRCODE = '42501';
  END IF;

  SELECT c.start_date INTO v_start FROM public.cash_ledger_config c WHERE c.clinic_id = v_clinic;
  IF v_start IS NULL THEN
    RETURN; -- fitur tidak aktif untuk klinik ini
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
    UNION SELECT u.id FROM public.users u WHERE u.clinic_id = v_clinic AND u.role = 'admin'
  )
  SELECT i.uid,
         u.full_name,
         COALESCE(rv.amt, 0),
         COALESCE(hi.confirmed, 0),
         COALESCE(ho.total_out, 0),
         COALESCE(ho.fin, 0),
         COALESCE(hi.pending, 0),
         COALESCE(rv.amt, 0) + COALESCE(hi.confirmed, 0) - COALESCE(ho.total_out, 0),
         rv.first_date
  FROM ids i
  LEFT JOIN public.users u ON u.id = i.uid
  LEFT JOIN recv rv ON rv.uid IS NOT DISTINCT FROM i.uid
  LEFT JOIN h_in hi ON hi.uid = i.uid
  LEFT JOIN h_out ho ON ho.uid = i.uid
  -- admin biasa hanya melihat saldonya sendiri; owner/super_admin melihat semua
  WHERE get_my_role() <> 'admin' OR i.uid = auth.uid()
  ORDER BY u.full_name NULLS LAST;
END;
$$;
REVOKE ALL ON FUNCTION public.get_cash_holdings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cash_holdings() TO authenticated;

-- Rincian cash masuk (per recap) milik seorang kasir, untuk tabel "belum disetor".
CREATE OR REPLACE FUNCTION public.get_cash_received_detail(p_user uuid, p_from date DEFAULT NULL)
RETURNS TABLE (
  recap_id    uuid,
  cash_date   date,
  patient_id  uuid,
  cash_amount numeric,
  tips_excluded numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid := get_my_clinic_id();
  v_start  date;
BEGIN
  IF get_my_role() NOT IN ('admin', 'owner', 'super_admin') THEN
    RAISE EXCEPTION 'Tidak diizinkan' USING ERRCODE = '42501';
  END IF;
  IF get_my_role() = 'admin' AND p_user IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Hanya bisa melihat rincian sendiri' USING ERRCODE = '42501';
  END IF;
  SELECT c.start_date INTO v_start FROM public.cash_ledger_config c WHERE c.clinic_id = v_clinic;
  IF v_start IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT r.id,
         COALESCE(r.revenue_date, r.recap_date),
         r.patient_id,
         public.recap_cash_amount(r),
         CASE WHEN lower(btrim(COALESCE(r.payment_method, ''))) IN ('cash', 'tunai')
              THEN COALESCE(r.tips_amount, 0) ELSE 0 END
  FROM public.daily_recaps r
  WHERE r.clinic_id = v_clinic
    AND r.cashier_id IS NOT DISTINCT FROM p_user
    AND COALESCE(r.revenue_date, r.recap_date) >= GREATEST(v_start, COALESCE(p_from, v_start))
    AND public.recap_cash_amount(r) > 0
  ORDER BY COALESCE(r.revenue_date, r.recap_date) DESC, r.created_at DESC
  LIMIT 300;
END;
$$;
REVOKE ALL ON FUNCTION public.get_cash_received_detail(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cash_received_detail(uuid, date) TO authenticated;

-- Buat setoran. Foto bukti wajib. Ke admin = pending (menunggu konfirmasi); ke
-- keuangan = langsung confirmed (cukup dicatat + foto bukti). Nominal tidak boleh melebihi saldo.
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
  v_balance numeric;
  v_id      uuid;
BEGIN
  IF get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'Hanya admin yang dapat membuat setoran' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cash_ledger_config WHERE clinic_id = v_clinic) THEN
    RAISE EXCEPTION 'Fitur setoran cash tidak aktif untuk klinik ini';
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
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_to_user AND u.clinic_id = v_clinic AND u.role = 'admin') THEN
      RAISE EXCEPTION 'Penerima bukan admin klinik ini';
    END IF;
  ELSE
    p_to_user := NULL;
  END IF;

  -- cegah dua setoran serentak melewati saldo
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

-- Penerima mengonfirmasi / menolak; pengirim boleh membatalkan selama pending.
CREATE OR REPLACE FUNCTION public.resolve_cash_handover(p_id uuid, p_action text, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  h public.cash_handovers%ROWTYPE;
BEGIN
  IF get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'Hanya admin' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO h FROM public.cash_handovers WHERE id = p_id AND clinic_id = get_my_clinic_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Setoran tidak ditemukan'; END IF;
  IF h.status <> 'pending' THEN RAISE EXCEPTION 'Setoran sudah diproses (%).', h.status; END IF;

  IF p_action IN ('confirm', 'reject') THEN
    IF h.to_user_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'Hanya penerima yang dapat mengonfirmasi/menolak' USING ERRCODE = '42501';
    END IF;
    IF p_action = 'reject' AND NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Alasan penolakan wajib diisi';
    END IF;
    UPDATE public.cash_handovers
       SET status = CASE WHEN p_action = 'confirm' THEN 'confirmed' ELSE 'rejected' END,
           confirmed_by = v_uid, confirmed_at = now(),
           reject_reason = CASE WHEN p_action = 'reject' THEN btrim(p_reason) END
     WHERE id = p_id;
  ELSIF p_action = 'cancel' THEN
    IF h.from_user_id <> v_uid THEN
      RAISE EXCEPTION 'Hanya pengirim yang dapat membatalkan' USING ERRCODE = '42501';
    END IF;
    UPDATE public.cash_handovers SET status = 'cancelled' WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'Aksi tidak dikenal';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_cash_handover(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_cash_handover(uuid, text, text) TO authenticated;
