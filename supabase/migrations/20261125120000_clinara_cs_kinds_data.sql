-- CS Clinara: jenis tiket (perubahan / bug / data) dan perubahan data lama khusus Praxis.
-- Perubahan data hanya untuk tiket yang diajukan OWNER, hanya baris klinik tiket itu, hanya tabel di daftar putih,
-- dan setiap baris dicatat nilai lamanya supaya bisa dikembalikan (/cs batal N).

ALTER TABLE public.clinara_cs_tickets
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'perubahan' CHECK (kind IN ('perubahan', 'bug', 'data')),
  ADD COLUMN IF NOT EXISTS requester_role text;

CREATE TABLE IF NOT EXISTS public.clinara_cs_data_tables (
  table_name text PRIMARY KEY
);
INSERT INTO public.clinara_cs_data_tables (table_name) VALUES ('appointments'), ('daily_recaps'), ('medical_records')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.clinara_cs_data_log (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id    bigint NOT NULL REFERENCES public.clinara_cs_tickets(id) ON DELETE CASCADE,
  table_name   text NOT NULL,
  row_id       text NOT NULL,
  old_row      jsonb NOT NULL,
  changed_cols text[] NOT NULL,
  reverted_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clinara_cs_data_log_ticket ON public.clinara_cs_data_log (ticket_id);

ALTER TABLE public.clinara_cs_data_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinara_cs_data_log   ENABLE ROW LEVEL SECURITY;
CREATE POLICY cs_data_log_read ON public.clinara_cs_data_log FOR SELECT TO authenticated
  USING ((SELECT get_my_role()) = 'super_admin');

CREATE OR REPLACE FUNCTION public.clinara_cs_data_update(p_ticket_id bigint, p_table text, p_ids text[], p_set jsonb)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_t    public.clinara_cs_tickets%ROWTYPE;
  v_col  text;
  v_sets text := '';
  v_n    int;
BEGIN
  SELECT * INTO v_t FROM public.clinara_cs_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tiket tidak ditemukan'; END IF;
  IF v_t.kind <> 'data' OR v_t.requester_role <> 'owner' THEN
    RAISE EXCEPTION 'Perubahan data hanya untuk tiket jenis data yang diajukan owner';
  END IF;
  IF v_t.clinic_id <> 'b25e8c29-6977-4e1b-b500-7629ec3aeb8a' THEN RAISE EXCEPTION 'Hanya klinik Praxis'; END IF;
  IF v_t.status NOT IN ('disetujui', 'dikerjakan') THEN RAISE EXCEPTION 'Tiket belum disetujui (status %)', v_t.status; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinara_cs_data_tables WHERE table_name = p_table) THEN
    RAISE EXCEPTION 'Tabel % tidak ada di daftar putih', p_table;
  END IF;
  IF p_ids IS NULL OR cardinality(p_ids) = 0 OR cardinality(p_ids) > 200 THEN
    RAISE EXCEPTION 'Jumlah baris harus 1-200';
  END IF;
  IF jsonb_typeof(p_set) <> 'object' OR p_set = '{}'::jsonb THEN RAISE EXCEPTION 'p_set kosong'; END IF;

  FOR v_col IN SELECT jsonb_object_keys(p_set) LOOP
    IF v_col IN ('id', 'clinic_id', 'created_at') THEN RAISE EXCEPTION 'Kolom % tidak boleh diubah', v_col; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = p_table AND column_name = v_col) THEN
      RAISE EXCEPTION 'Kolom % tidak ada di %', v_col, p_table;
    END IF;
    v_sets := v_sets || format('%I = (jsonb_populate_record(null::public.%I, $1)).%I, ', v_col, p_table, v_col);
  END LOOP;
  v_sets := left(v_sets, -2);

  EXECUTE format(
    'INSERT INTO public.clinara_cs_data_log (ticket_id, table_name, row_id, old_row, changed_cols)
       SELECT $2, %L, t.id::text, to_jsonb(t), $3 FROM public.%I t WHERE t.clinic_id = $4 AND t.id::text = ANY($5)',
    p_table, p_table) USING p_set, p_ticket_id, ARRAY(SELECT jsonb_object_keys(p_set)), v_t.clinic_id, p_ids;

  EXECUTE format('UPDATE public.%I SET %s WHERE clinic_id = $2 AND id::text = ANY($3)', p_table, v_sets)
    USING p_set, v_t.clinic_id, p_ids;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  UPDATE public.clinara_cs_tickets SET status = 'dikerjakan', updated_at = now() WHERE id = p_ticket_id;
  RETURN v_n;
END $$;

CREATE OR REPLACE FUNCTION public.clinara_cs_revert_data(p_ticket_id bigint)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; v_col text; v_sets text; n int := 0;
BEGIN
  FOR a IN SELECT * FROM public.clinara_cs_data_log WHERE ticket_id = p_ticket_id AND reverted_at IS NULL ORDER BY id DESC LOOP
    v_sets := '';
    FOREACH v_col IN ARRAY a.changed_cols LOOP
      v_sets := v_sets || format('%I = (jsonb_populate_record(null::public.%I, $1)).%I, ', v_col, a.table_name, v_col);
    END LOOP;
    v_sets := left(v_sets, -2);
    EXECUTE format('UPDATE public.%I SET %s WHERE clinic_id = $2 AND id::text = $3', a.table_name, v_sets)
      USING a.old_row, 'b25e8c29-6977-4e1b-b500-7629ec3aeb8a'::uuid, a.row_id;
    UPDATE public.clinara_cs_data_log SET reverted_at = now() WHERE id = a.id;
    n := n + 1;
  END LOOP;
  UPDATE public.clinara_cs_tickets SET status = 'dibatalkan', updated_at = now() WHERE id = p_ticket_id;
  INSERT INTO public.clinara_cs_messages (ticket_id, sender, body)
  VALUES (p_ticket_id, 'cs', 'Perubahan data dibatalkan dan dikembalikan seperti semula.');
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.clinara_cs_data_update(bigint, text, text[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clinara_cs_revert_data(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clinara_cs_data_update(bigint, text, text[], jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.clinara_cs_revert_data(bigint) TO service_role;
