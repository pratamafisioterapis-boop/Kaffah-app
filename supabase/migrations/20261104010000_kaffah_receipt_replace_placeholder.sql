-- Trigger lama (trigger_generate_receipt_number, AFTER INSERT) memberi setiap recap nomor
-- RCPT/YYYYMM/NNNN begitu dibuat, sehingga assign_kaffah_receipt_number menganggap recap Kaffah
-- sudah bernomor dan format KFF/XI/2026/0042 tidak pernah dipakai.
--
-- Sekarang nomor RCPT/... pada recap Kaffah dianggap penampung (placeholder) dan diganti nomor
-- KFF bila: recap belum pernah dikirim (invoice_url kosong), belum ada baris invoice_records
-- (tidak pernah diunduh/dikirim), dan terbit sejak clinics.invoice_layout_from. Invoice yang
-- sudah terbit atau diunduh tetap memakai nomornya.
-- Urutan = max(nomor KFF bulan itu, jumlah recap bulan itu yang sudah bernomor, tidak termasuk
-- recap ini) + 1.
CREATE OR REPLACE FUNCTION public.assign_kaffah_receipt_number(p_recap_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_clinic uuid;
  v_date date;
  v_existing text;
  v_url text;
  v_inv_at timestamptz;
  v_created timestamptz;
  v_from timestamptz;
  v_replace boolean := false;
  v_prefix text;
  v_max integer;
  v_count integer;
  v_new text;
  v_roman text[] := ARRAY['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
BEGIN
  SELECT clinic_id, COALESCE(revenue_date, recap_date), receipt_number, invoice_url, invoice_created_at, created_at
    INTO v_clinic, v_date, v_existing, v_url, v_inv_at, v_created
  FROM public.daily_recaps WHERE id = p_recap_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recap tidak ditemukan';
  END IF;

  IF v_clinic <> 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid THEN
    RETURN NULLIF(btrim(COALESCE(v_existing, '')), '');
  END IF;

  IF v_existing IS NOT NULL AND btrim(v_existing) <> '' THEN
    IF v_existing LIKE 'RCPT/%' AND v_url IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.invoice_records ir WHERE ir.daily_recap_id = p_recap_id) THEN
      SELECT invoice_layout_from INTO v_from FROM public.clinics WHERE id = v_clinic;
      IF v_from IS NOT NULL AND COALESCE(v_inv_at, v_created) >= v_from THEN
        v_replace := true;
      END IF;
    END IF;
    IF NOT v_replace THEN
      RETURN v_existing;
    END IF;
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
    AND id <> p_recap_id
    AND receipt_number IS NOT NULL AND btrim(receipt_number) <> ''
    AND COALESCE(revenue_date, recap_date) >= date_trunc('month', v_date)::date
    AND COALESCE(revenue_date, recap_date) <  (date_trunc('month', v_date) + interval '1 month')::date;

  v_new := v_prefix || lpad((GREATEST(v_max, v_count) + 1)::text, 4, '0');

  UPDATE public.daily_recaps SET receipt_number = v_new
  WHERE id = p_recap_id
    AND (receipt_number IS NULL OR btrim(receipt_number) = '' OR (v_replace AND receipt_number = v_existing));

  RETURN v_new;
END;
$$;
