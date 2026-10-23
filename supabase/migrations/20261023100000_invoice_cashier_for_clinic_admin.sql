-- Invoice Praxis: nama & TTD kasir hilang saat invoice dibuka user lain.
-- Penyebab: policy SELECT public.users hanya mengizinkan role admin/owner
-- (+ profil sendiri), sehingga clinic_admin/terapis tidak bisa membaca
-- full_name & signature_url admin pembuat recap. RPC ini hanya mengembalikan
-- dua kolom itu, dan hanya untuk user yang satu klinik dengan pemanggil.
CREATE OR REPLACE FUNCTION public.get_invoice_cashier(p_user_id uuid)
RETURNS TABLE (full_name text, signature_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.full_name, u.signature_url
  FROM public.users u
  WHERE u.id = p_user_id
    AND u.role IN ('admin', 'clinic_admin', 'owner')
    AND (u.clinic_id = public.get_my_clinic_id() OR public.get_my_role() = 'super_admin');
$$;

REVOKE ALL ON FUNCTION public.get_invoice_cashier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_invoice_cashier(uuid) TO authenticated;
