-- Perbaikan: persetujuan pengajuan "Ubah diskon (invoice terbit)" gagal dengan pesan
-- 'Diskon "Referral welcome reward" hanya bisa dipakai lewat kartu Diskon Welcome Reward.'
-- Trigger welcome/birthday memblokir label reward di klinik SOAP-first untuk semua UPDATE,
-- termasuk saat owner menyetujui pengajuan lewat soap_first_decide_override (yang menyalakan
-- app.soap_first_rpc). Blokir hanya berlaku untuk jalur biasa, bukan RPC resmi tersebut.
-- Fungsi dipatch dari definisi yang aktif.

DO $patch$
DECLARE
  d text;
  d2 text;
BEGIN
  d := pg_get_functiondef('public.trg_ac_welcome_reward_validate_on_recap()'::regprocedure);
  d2 := replace(d,
    '''referral welcome reward''' || E'\n',
    '''referral welcome reward''' || E'\n       AND COALESCE(current_setting(''app.soap_first_rpc'', true), '''') <> ''on''' || E'\n');
  IF d2 = d THEN RAISE EXCEPTION 'patch welcome trigger gagal'; END IF;
  EXECUTE d2;

  d := pg_get_functiondef('public.trg_aa_birthday_reward_validate_on_recap()'::regprocedure);
  d2 := replace(d,
    '''birthday reward''' || E'\n',
    '''birthday reward''' || E'\n       AND COALESCE(current_setting(''app.soap_first_rpc'', true), '''') <> ''on''' || E'\n');
  IF d2 = d THEN RAISE EXCEPTION 'patch birthday trigger gagal'; END IF;
  EXECUTE d2;
END
$patch$;
