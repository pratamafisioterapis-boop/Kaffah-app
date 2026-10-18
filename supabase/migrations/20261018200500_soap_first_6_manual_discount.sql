-- SOAP-first (KHUSUS Kaffah) - diskon manual dengan persetujuan owner (mis. jenis diskon "Keluarga").
-- Jenis diskon tanpa nilai tetap di Setup dianggap manual: admin mengisi jenis & nilai lewat pengajuan
-- (kind 'manual_discount'); nilai yang disetujui owner itulah yang diterapkan server saat pembayaran.
-- Sudah diterapkan di produksi lewat patch fungsi (soap_first_8/9); file ini dokumentasi hasil akhirnya.

ALTER TABLE public.soap_overrides DROP CONSTRAINT soap_overrides_kind_check;
ALTER TABLE public.soap_overrides ADD CONSTRAINT soap_overrides_kind_check
  CHECK (kind IN ('payment_unlock', 'incentive_restore', 'homecare_discount', 'xtratime', 'package_extend', 'amount_adjust', 'manual_discount'));

-- trg_ab_soap_first_prepare: bila nilai diskon opsi kosong -> pakai payload override 'manual_discount' yang disetujui
--   (jenis & nilai dari payload); tanpa persetujuan: "Diskon ... diinput manual dan wajib disetujui owner".
--   Persetujuan manual juga menggantikan syarat override 'homecare_discount'. Paket tetap tidak bisa diskon.
-- soap_first_request_override: menerima kind 'manual_discount' dengan payload {discount_type: nominal|percentage,
--   discount_value > 0 (<= 100 bila persen), discount_label}.
