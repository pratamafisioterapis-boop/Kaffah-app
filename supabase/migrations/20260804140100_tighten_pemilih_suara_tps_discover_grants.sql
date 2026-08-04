-- pemilih_suara_tps_discover picked up the default PUBLIC/anon execute
-- grant on creation (unlike the other pemilih_* RPCs in this project, which
-- only grant to authenticated). RLS on pemilih_suara_caleg_tps already
-- makes an anon call return zero rows, but tighten it anyway to match the
-- rest of the module's convention.
revoke execute on function public.pemilih_suara_tps_discover(uuid[], int) from public;
revoke execute on function public.pemilih_suara_tps_discover(uuid[], int) from anon;
