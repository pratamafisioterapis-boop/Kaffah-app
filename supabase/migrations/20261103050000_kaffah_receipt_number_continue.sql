-- Nomor kwitansi Kaffah menyambung dari penomoran bulan berjalan: urutan berikutnya =
-- jumlah recap bulan itu yang sudah bernomor (format lama maupun baru) + 1, atau nomor baru
-- tertinggi + 1 bila lebih besar. Jadi bulan yang sudah berjalan tidak mulai lagi dari 0001.
CREATE OR REPLACE FUNCTION public.assign_kaffah_receipt_number(p_recap_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_clinic uuid;
  v_date date;
  v_existing text;
  v_prefix text;
  v_max integer;
  v_count integer;
  v_new text;
  v_roman text[] := ARRAY['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
BEGIN
  SELECT clinic_id, COALESCE(revenue_date, recap_date), receipt_number
    INTO v_clinic, v_date, v_existing
  FROM public.daily_recaps WHERE id = p_recap_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recap tidak ditemukan';
  END IF;

  IF v_existing IS NOT NULL AND btrim(v_existing) <> '' THEN
    RETURN v_existing;
  END IF;

  IF v_clinic <> 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid THEN
    RETURN NULL;
  END IF;

  v_prefix := 'KFF/' || v_roman[EXTRACT(MONTH FROM v_date)::int] || '/' || EXTRACT(YEAR FROM v_date)::int || '/';

  -- Kunci per bulan: dua admin yang membuka invoice bersamaan tidak mendapat nomor yang sama.
  PERFORM pg_advisory_xact_lock(hashtext('kff_receipt_' || v_prefix));

  SELECT COALESCE(MAX(substring(receipt_number FROM '([0-9]+)$')::integer), 0)
    INTO v_max
  FROM public.daily_recaps
  WHERE clinic_id = v_clinic
    AND receipt_number LIKE v_prefix || '%'
    AND receipt_number ~ '^KFF/[IVX]+/[0-9]{4}/[0-9]+$';

  SELECT COUNT(*)
    INTO v_count
  FROM public.daily_recaps
  WHERE clinic_id = v_clinic
    AND receipt_number IS NOT NULL AND btrim(receipt_number) <> ''
    AND COALESCE(revenue_date, recap_date) >= date_trunc('month', v_date)::date
    AND COALESCE(revenue_date, recap_date) <  (date_trunc('month', v_date) + interval '1 month')::date;

  v_new := v_prefix || lpad((GREATEST(v_max, v_count) + 1)::text, 4, '0');

  UPDATE public.daily_recaps SET receipt_number = v_new
  WHERE id = p_recap_id AND (receipt_number IS NULL OR btrim(receipt_number) = '');

  RETURN v_new;
END;
$$;
