-- register-clinic sekarang otomatis mengisi kolom subdomain untuk klinik
-- baru (lihat supabase/functions/register-clinic). Migration ini
-- membackfill klinik-klinik yang sudah terdaftar sebelum perubahan
-- tersebut, supaya situs & booking online tenant mereka
-- (<subdomain>.clinara.id) langsung aktif tanpa perlu diisi manual oleh
-- pemilik klinik. Kaffah Physiotherapy sengaja dilewati karena sudah
-- punya domain utamanya sendiri (kaffahphysio.id).

UPDATE public.clinics
SET subdomain = 'grand-physiocare'
WHERE id = '61c1dd29-3bab-40df-932f-db6b298f52bb' AND subdomain IS NULL;

UPDATE public.clinics
SET subdomain = 'griya-fisioterapi-cepu'
WHERE id = '3ecdf1e3-8fb7-4bd2-9c94-ce3737b7b978' AND subdomain IS NULL;

UPDATE public.clinics
SET subdomain = 'wonosobo-therapy-center'
WHERE id = '278456ff-b665-4375-9b45-41547500d838' AND subdomain IS NULL;

UPDATE public.clinics
SET subdomain = 'sentosa-medika-physiotherapy'
WHERE id = '139e0d36-50f0-4185-82fa-d284123019c2' AND subdomain IS NULL;
