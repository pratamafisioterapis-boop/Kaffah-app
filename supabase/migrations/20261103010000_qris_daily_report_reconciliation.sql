-- Fitur: rekonsiliasi QRIS harian (khusus Kaffah Physiotherapy).
-- Setiap malam admin mengunggah PDF "Laporan Transaksi" QRIS dari BSI Merchant.
-- Tiap transaksi di laporan dicocokkan otomatis dengan pembayaran QRIS di
-- daily_recaps pada tanggal yang sama (nominal + jam + nama).
--
-- Tabel bsi_* yang lama hanya bisa ditulis owner (lihat rls_audit_tahap1), jadi
-- fitur ini memakai tabel sendiri yang bisa ditulis admin klinik Kaffah.

CREATE TABLE IF NOT EXISTS public.qris_report_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  file_name text,
  mid text,
  mpan text,
  total_count integer NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  total_net numeric NOT NULL DEFAULT 0,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, report_date)
);

CREATE TABLE IF NOT EXISTS public.qris_report_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES public.qris_report_uploads(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  trx_date date NOT NULL,
  trx_time text,
  issuer text,
  customer_name text,
  ref_no text,
  rrn text,
  amount numeric NOT NULL,
  mdr numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL,
  matched_recap_id uuid REFERENCES public.daily_recaps(id) ON DELETE SET NULL,
  match_method text CHECK (match_method IN ('auto', 'manual')),
  matched_at timestamptz,
  matched_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qris_report_transactions_upload ON public.qris_report_transactions(upload_id);
CREATE INDEX IF NOT EXISTS idx_qris_report_transactions_recap ON public.qris_report_transactions(matched_recap_id);
-- RRN unik per klinik: mencegah transaksi yang sama tercatat dua kali bila PDF tumpang tindih.
CREATE UNIQUE INDEX IF NOT EXISTS uq_qris_report_transactions_rrn
  ON public.qris_report_transactions(clinic_id, rrn) WHERE rrn IS NOT NULL;

ALTER TABLE public.qris_report_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qris_report_transactions ENABLE ROW LEVEL SECURITY;

-- Hanya staf admin/owner klinik Kaffah (dan super_admin).
CREATE POLICY qris_report_kaffah ON public.qris_report_uploads FOR ALL TO authenticated
  USING (
    (SELECT get_my_role()) = 'super_admin'
    OR ((SELECT get_my_role()) IN ('owner', 'admin', 'clinic_admin')
        AND clinic_id = (SELECT get_my_clinic_id())
        AND clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid))
  WITH CHECK (
    (SELECT get_my_role()) = 'super_admin'
    OR ((SELECT get_my_role()) IN ('owner', 'admin', 'clinic_admin')
        AND clinic_id = (SELECT get_my_clinic_id())
        AND clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid));

CREATE POLICY qris_report_kaffah ON public.qris_report_transactions FOR ALL TO authenticated
  USING (
    (SELECT get_my_role()) = 'super_admin'
    OR ((SELECT get_my_role()) IN ('owner', 'admin', 'clinic_admin')
        AND clinic_id = (SELECT get_my_clinic_id())
        AND clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid))
  WITH CHECK (
    (SELECT get_my_role()) = 'super_admin'
    OR ((SELECT get_my_role()) IN ('owner', 'admin', 'clinic_admin')
        AND clinic_id = (SELECT get_my_clinic_id())
        AND clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid));
