-- Notifikasi "Pengajuan pengecualian" (Telegram/push) sebelumnya hanya berisi
-- "<pengaju> - <alasan>", jadi owner tidak tahu pasien mana yang dimaksud
-- (mis. "Sila - keluarga" untuk pasien FREE). Tambahkan baris ke-3 "Pasien: <nama>".
-- Baris 1-2 TIDAK diubah: tombol Setujui/Tolak (send-telegram) dan tg_decide_override
-- hanya membaca baris 1 (label) dan baris 2 ("pengaju - alasan").
-- Fungsi dipatch dari definisi yang aktif.

DO $patch$
DECLARE
  d text;
  d2 text;
  fn regprocedure;
  old_s constant text := 'COALESCE(v_name, ''Admin'') || '' - '' || btrim(p_reason), ''/owner/overrides'');';
  new_s constant text := 'COALESCE(v_name, ''Admin'') || '' - '' || btrim(p_reason)' || E'\n' ||
    '        || COALESCE((SELECT E''\nPasien: '' || COALESCE(NULLIF(btrim(r.full_name), ''''), NULLIF(btrim(r.guest_name), ''''), ''-'')' || E'\n' ||
    '                     FROM daily_recaps r WHERE r.id = p_recap_id), ''''), ''/owner/overrides'');';
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.soap_first_request_override(text,uuid,text,jsonb,uuid)'::regprocedure,
    'public.request_package_release(uuid,text)'::regprocedure
  ] LOOP
    d := pg_get_functiondef(fn);
    d2 := replace(d, old_s, new_s);
    IF d2 = d THEN RAISE EXCEPTION 'patch % gagal (pola notifikasi tidak ditemukan)', fn; END IF;
    EXECUTE d2;
  END LOOP;
END
$patch$;
