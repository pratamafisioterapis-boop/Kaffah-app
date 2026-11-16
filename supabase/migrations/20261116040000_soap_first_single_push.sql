-- Hentikan push dobel untuk notifikasi bertipe 'soap_first'.
--
-- soap_first_notify() mengirim push lewat DUA jalur untuk satu kejadian:
--   (1) INSERT ke notifications -> trg_push_notification -> trigger_push_notification()
--   (2) soap_first_push() -> send-push-notification langsung (membawa url tujuan)
-- Akibatnya setiap perangkat menerima dua notifikasi (service worker tidak
-- memakai tag, jadi keduanya tampil). Diukur: 2 push per kejadian.
--
-- Perbaikan: trigger_push_notification() melewati tipe 'soap_first', karena
-- jalur (2) sudah mengirim push dan membawa url yang benar (penting untuk
-- terapis). Baris di tabel notifications tetap dibuat, jadi daftar notifikasi
-- di dalam aplikasi tidak berubah. Tipe lain (BOOKING_*, SOAP_LOCKED, dll.)
-- tidak terpengaruh. Satu-satunya penyisip tipe 'soap_first' adalah
-- soap_first_notify(), yang selalu memanggil soap_first_push().

do $do$
declare
  def text;
  old text;
  new text;
begin
  select pg_get_functiondef('public.trigger_push_notification()'::regprocedure) into def;
  if position($a$NEW.type = 'soap_first'$a$ in def) > 0 then
    return;
  end if;

  old := $a$BEGIN

    SELECT appointment_date::date::text$a$;
  new := $a$BEGIN

    -- soap_first dikirim lewat soap_first_push() (dengan url tujuan); jangan dobel.
    IF NEW.type = 'soap_first' THEN
        RETURN NEW;
    END IF;

    SELECT appointment_date::date::text$a$;
  if position(old in def) = 0 then raise exception 'jangkar tidak ditemukan'; end if;
  def := replace(def, old, new);

  execute def;
end
$do$;
