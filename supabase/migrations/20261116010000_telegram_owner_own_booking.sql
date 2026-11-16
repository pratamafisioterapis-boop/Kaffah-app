-- Aksi booking oleh akun owner Kaffah sendiri ikut masuk ke Telegram.
--
-- Trigger notify_booking_created / notify_booking_rescheduled /
-- notify_booking_cancelled sengaja tidak memberi notifikasi kepada pembuat
-- aksinya (u.id <> NEW.action_by). Akibatnya, kalau owner sendiri yang
-- membuat, me-reschedule, atau membatalkan appointment, tidak ada push dan
-- karena itu tidak ada pesan Telegram (Telegram hanya menyalin push owner).
--
-- Trigger baru ini TIDAK mengubah tiga trigger lama. Ia hanya aktif bila
-- action_by adalah owner klinik Kaffah, lalu mengirim ke Telegram saja pesan
-- dengan format yang sama persis dengan salinan push:
--   🔔 <judul>
--   <hari, tanggal bulan tahun jam>
--
--   Pasien    : <nama>
--   Terapis   : <nama>
--
--   By <nama pembuat aksi>
-- Aturan kapan terkirim sama dengan tiga fungsi lama (insert = NEW APPOINTMENT;
-- berubah ke cancelled = CANCELLED; jadwal/terapis berubah = RESCHEDULED).
-- Seluruh pengiriman dibungkus penangkap galat supaya Telegram tidak pernah
-- menggagalkan penyimpanan booking.

create or replace function tgreport.id_datetime(p_ts timestamptz) returns text
language sql stable as $fn$
  select (array['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'])[extract(dow from p_ts at time zone 'Asia/Makassar')::int + 1]
    || ', ' || extract(day from p_ts at time zone 'Asia/Makassar')::int
    || ' ' || (array['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'])[extract(month from p_ts at time zone 'Asia/Makassar')::int]
    || ' ' || extract(year from p_ts at time zone 'Asia/Makassar')::int
    || ' ' || to_char(p_ts at time zone 'Asia/Makassar', 'HH24:MI')
$fn$;

create or replace function tgreport.mirror_owner_booking() returns trigger
language plpgsql security definer set search_path = public, tgreport as $fn$
declare
  v_title text;
  v_patient text;
  v_therapist text;
  v_text text;
  v_secret text;
begin
  begin
    if NEW.clinic_id is distinct from tgreport.clinic_id() or NEW.action_by is null then
      return NEW;
    end if;
    if not exists (select 1 from public.users u
                    where u.id = NEW.action_by and u.role = 'owner'
                      and u.clinic_id = tgreport.clinic_id()) then
      return NEW;
    end if;

    if TG_OP = 'INSERT' then
      v_title := '✅ NEW APPOINTMENT';
    elsif NEW.status = 'cancelled' and OLD.status is distinct from 'cancelled' then
      v_title := '❌ CANCELLED';
    elsif NEW.status is distinct from 'cancelled' and OLD.status is distinct from 'cancelled'
          and not (NEW.appointment_date = OLD.appointment_date
                   and NEW.therapist_id is not distinct from OLD.therapist_id) then
      v_title := '🔄 RESCHEDULED';
    else
      return NEW;
    end if;

    select coalesce(p.full_name, NEW.guest_name, 'Pasien') into v_patient
    from public.patients p where p.id = NEW.patient_id;
    v_patient := coalesce(v_patient, NEW.guest_name, 'Pasien');

    select name into v_therapist from public.physiotherapists where id = NEW.therapist_id;

    v_text := '🔔 ' || v_title || E'\n' ||
              tgreport.id_datetime(NEW.appointment_date) || E'\n\n' ||
              'Pasien    : ' || v_patient || E'\n' ||
              'Terapis   : ' || coalesce(v_therapist, '-') || E'\n\n' ||
              'By ' || coalesce(NEW.action_by_name, 'System');

    select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'telegram_internal_secret' limit 1;
    if v_secret is null then
      return NEW;
    end if;

    perform net.http_post(
      url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-telegram',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_secret),
      body := jsonb_build_object('event', 'booking_owner_sendiri',
                                 'clinic_id', tgreport.clinic_id(),
                                 'text', v_text),
      timeout_milliseconds := 10000
    );
  exception when others then
    null; -- Telegram tidak boleh mengganggu penyimpanan booking
  end;
  return NEW;
end
$fn$;

revoke all on function tgreport.id_datetime(timestamptz) from public, anon, authenticated;
revoke all on function tgreport.mirror_owner_booking() from public, anon, authenticated;

drop trigger if exists trg_telegram_owner_booking on public.appointments;
create trigger trg_telegram_owner_booking
  after insert or update on public.appointments
  for each row
  when (new.action_by is not null)
  execute function tgreport.mirror_owner_booking();
