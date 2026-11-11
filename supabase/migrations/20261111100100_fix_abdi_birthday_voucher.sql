-- Koreksi satu kali: rekap Abdi Nugroho (KFF/XI/2026/0138, 11 Nov 2026) memakai voucher
-- ultah Irma Soffa (Rp 100.000). Disetujui owner. Invoice sudah terbit, jadi kunci
-- nominal dilewati lewat app.soap_first_rpc; validasi voucher dilewati karena tidak ada
-- user login di SQL Editor/migrasi (kelayakan sudah dicek manual).
-- Prasyarat: 20261111100000_birthday_reward_transferable.sql sudah terpasang.
ALTER TABLE public.daily_recaps DISABLE TRIGGER ab_birthday_reward_validate;
SELECT set_config('app.soap_first_rpc', 'on', true);

UPDATE public.daily_recaps r
SET birthday_reward_year = 2026,
    birthday_reward_patient_id = 'b59afffb-85c7-4e90-a020-ade89fbfa8f9',
    discount_type = 'nominal',
    discount_value = 100000,
    discount_label = 'Birthday reward',
    amount = r.amount_original - 100000,
    net_amount = (r.amount_original - 100000) - COALESCE(r.fee_amount, 0)
WHERE r.id = '2ccfe093-3f7f-4b64-b4a2-7467ed637836'
  AND r.patient_id = '6745aa60-23af-4211-b04e-63784c03d41d'
  AND r.birthday_reward_year IS NULL;

SELECT set_config('app.soap_first_rpc', 'off', true);
ALTER TABLE public.daily_recaps ENABLE TRIGGER ab_birthday_reward_validate;

SELECT id, amount, amount_original, discount_type, discount_value, discount_label,
       net_amount, birthday_reward_year, birthday_reward_patient_id
FROM public.daily_recaps WHERE id = '2ccfe093-3f7f-4b64-b4a2-7467ed637836';
