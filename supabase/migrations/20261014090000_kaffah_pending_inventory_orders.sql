-- Kaffah-only: "Pesanan Dalam Perjalanan" for online purchases. The payment is
-- recorded on the day it is made, but stock only enters the warehouse once the
-- goods are marked received (receive_pending_inventory_order reuses
-- restock_inventory_item, so weighted-average price and Riwayat Pembelian
-- behave exactly like a normal restock; purchase_date stays the payment date).

CREATE TABLE IF NOT EXISTS public.inventory_pending_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity numeric NOT NULL CHECK (quantity > 0),
  total_price numeric NOT NULL CHECK (total_price >= 0),
  paid_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date,
  supplier text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'cancelled')),
  received_date date,
  received_quantity numeric,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_pending_orders_clinic_status
  ON public.inventory_pending_orders (clinic_id, status);

ALTER TABLE public.inventory_pending_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_isolated_inventory_pending_orders
  ON public.inventory_pending_orders
  FOR ALL
  USING (get_my_role() = 'super_admin' OR clinic_id = get_my_clinic_id())
  WITH CHECK (get_my_role() = 'super_admin' OR clinic_id = get_my_clinic_id());

CREATE OR REPLACE FUNCTION public.create_pending_inventory_order(
  p_item_id uuid,
  p_quantity numeric,
  p_total_price numeric,
  p_paid_date date DEFAULT CURRENT_DATE,
  p_expected_date date DEFAULT NULL,
  p_supplier text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
 RETURNS inventory_pending_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $fn$
DECLARE
  v_clinic_id uuid := get_my_clinic_id();
  v_item public.inventory_items;
  v_order public.inventory_pending_orders;
BEGIN
  IF v_clinic_id IS DISTINCT FROM 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid THEN
    RAISE EXCEPTION 'Fitur pesanan dalam perjalanan hanya tersedia untuk Kaffah Physiotherapy';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Kuantitas pesanan harus lebih dari 0';
  END IF;
  IF p_total_price IS NULL OR p_total_price < 0 THEN
    RAISE EXCEPTION 'Harga total tidak valid';
  END IF;

  SELECT * INTO v_item FROM public.inventory_items
    WHERE id = p_item_id AND clinic_id = v_clinic_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Barang tidak ditemukan';
  END IF;

  INSERT INTO public.inventory_pending_orders
    (clinic_id, item_id, quantity, total_price, paid_date, expected_date, supplier, notes, created_by)
  VALUES
    (v_clinic_id, p_item_id, p_quantity, p_total_price, COALESCE(p_paid_date, CURRENT_DATE), p_expected_date, p_supplier, p_notes, auth.uid())
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.receive_pending_inventory_order(
  p_id uuid,
  p_received_quantity numeric DEFAULT NULL,
  p_received_date date DEFAULT CURRENT_DATE
)
 RETURNS inventory_pending_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $fn$
DECLARE
  v_clinic_id uuid := get_my_clinic_id();
  v_order public.inventory_pending_orders;
  v_qty numeric;
  v_note text;
BEGIN
  IF v_clinic_id IS DISTINCT FROM 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid THEN
    RAISE EXCEPTION 'Fitur pesanan dalam perjalanan hanya tersedia untuk Kaffah Physiotherapy';
  END IF;

  SELECT * INTO v_order FROM public.inventory_pending_orders
    WHERE id = p_id AND clinic_id = v_clinic_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan';
  END IF;
  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'Pesanan ini sudah diproses (status: %)', v_order.status;
  END IF;

  v_qty := COALESCE(p_received_quantity, v_order.quantity);
  IF v_qty <= 0 THEN
    RAISE EXCEPTION 'Kuantitas diterima harus lebih dari 0';
  END IF;

  v_note := 'Pesanan online, diterima ' || to_char(COALESCE(p_received_date, CURRENT_DATE), 'DD-MM-YYYY')
    || COALESCE(' - ' || NULLIF(v_order.supplier, ''), '')
    || COALESCE(' - ' || NULLIF(v_order.notes, ''), '');

  PERFORM public.restock_inventory_item(v_order.item_id, v_qty, v_order.total_price, v_order.paid_date, v_note);

  UPDATE public.inventory_pending_orders
    SET status = 'received',
        received_date = COALESCE(p_received_date, CURRENT_DATE),
        received_quantity = v_qty
    WHERE id = p_id
    RETURNING * INTO v_order;

  RETURN v_order;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.cancel_pending_inventory_order(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $fn$
DECLARE
  v_clinic_id uuid := get_my_clinic_id();
BEGIN
  UPDATE public.inventory_pending_orders
    SET status = 'cancelled'
    WHERE id = p_id AND clinic_id = v_clinic_id AND status = 'pending'
      AND v_clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan atau sudah diproses';
  END IF;
END;
$fn$;
