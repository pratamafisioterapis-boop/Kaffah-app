-- Kaffah: pilih "Konsultasi" di form Edit Recap Harian -> nominal langsung tampil.
-- Sebelumnya quote dihitung dari special_type yang SUDAH tersimpan, dan harga baru keluar
-- setelah SOAP selesai. Sekarang:
--  1. quote menerima special_type pilihan form (belum disimpan) agar harga mengikuti pilihan.
--  2. untuk Konsultasi, harga tetap ditampilkan walau SOAP/TTV belum selesai.
--     Kunci pembayaran TIDAK berubah: 'error' tetap diisi dan trigger tetap menolak invoice.
-- Fungsi lama (2 argumen) di-drop agar tidak ada overload ambigu di PostgREST.

DROP FUNCTION IF EXISTS public.soap_first_quote(uuid, text);

CREATE OR REPLACE FUNCTION public.soap_first_quote(
  p_recap_id uuid,
  p_package_label text DEFAULT NULL,
  p_special_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  d public.daily_recaps;
  v jsonb;
  v_price numeric;
BEGIN
  SELECT * INTO d FROM daily_recaps WHERE id = p_recap_id;
  IF NOT FOUND OR d.clinic_id IS DISTINCT FROM get_my_clinic_id() THEN
    RETURN jsonb_build_object('active', false);
  END IF;

  -- Pilihan form yang belum disimpan ('' = tanpa jenis khusus).
  IF p_special_type IS NOT NULL AND d.invoice_created_at IS NULL THEN
    d.special_type := NULLIF(btrim(p_special_type), '');
  END IF;

  v := soap_first_compute(d, d.amount_original, p_package_label);

  -- Preview harga Konsultasi walau pembayaran masih terkunci (SOAP/TTV belum selesai).
  IF COALESCE((v ->> 'active')::boolean, false)
     AND v ->> 'total' IS NULL
     AND v ->> 'type_label' = 'KONSULTASI'
     AND v ->> 'type_id' IS NOT NULL THEN
    SELECT p.price INTO v_price FROM clinic_service_prices p
    WHERE p.clinic_id = d.clinic_id AND p.patient_type_id = (v ->> 'type_id')::uuid;
    IF v_price IS NOT NULL THEN
      v := v || jsonb_build_object('base', v_price, 'total', v_price, 'price_preview', true);
    END IF;
  END IF;

  RETURN v || jsonb_build_object(
    'invoice_locked', (d.invoice_created_at IS NOT NULL),
    'special_type', d.special_type,
    'xtratime', d.xtratime
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.soap_first_quote(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soap_first_quote(uuid, text, text) TO authenticated;
