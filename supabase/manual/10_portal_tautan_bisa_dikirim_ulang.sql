-- Tautan Clinara yang sudah dibuat bisa dikirim ulang lewat WhatsApp tanpa membuat tautan baru.
-- Sebelumnya hanya hash token yang disimpan, jadi tautan hanya terlihat sekali saat dibuat.
-- Sekarang token disimpan di token_plain dan hanya dibaca staf klinik lewat portal_get_link_token.
-- Tautan yang dibuat sebelum migrasi ini tidak punya token_plain: buat tautan baru satu kali.
-- Tanpa DROP: aman dijalankan lewat apply_migration.

alter table public.patient_portal_links add column if not exists token_plain text;

create or replace function public.portal_create_link(p_patient_id uuid, p_valid_days int default null)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $fn$
declare
  v_role text := get_my_role();
  v_patient public.patients%rowtype;
  v_token text;
  v_link uuid;
  v_exp timestamptz;
begin
  if v_role is null or v_role not in ('super_admin','owner','admin','clinic_admin','therapist') then
    raise exception 'Tidak berwenang' using errcode = '42501';
  end if;
  select * into v_patient from public.patients where id = p_patient_id;
  if not found or (v_role <> 'super_admin' and v_patient.clinic_id is distinct from get_my_clinic_id()) then
    raise exception 'Pasien tidak ditemukan' using errcode = 'P0002';
  end if;
  if not public.portal_clinic_enabled(v_patient.clinic_id) then
    raise exception 'Fitur Clinara untuk pasien belum diaktifkan di klinik ini' using errcode = '42501';
  end if;
  if v_patient.birth_date is null then
    raise exception 'Tanggal lahir pasien belum diisi' using errcode = 'P0001';
  end if;

  update public.patient_portal_links set status = 'revoked', token_plain = null
    where patient_id = p_patient_id and status <> 'revoked';

  v_token := public.portal_new_token();
  v_exp := case when p_valid_days is null then null else now() + make_interval(days => greatest(1, p_valid_days)) end;
  insert into public.patient_portal_links (clinic_id, patient_id, token_hash, token_plain, expires_at, created_by)
    values (v_patient.clinic_id, p_patient_id, public.portal_hash(v_token), v_token, v_exp, auth.uid())
    returning id into v_link;

  return jsonb_build_object('link_id', v_link, 'token', v_token, 'expires_at', v_exp,
    'patient_name', v_patient.full_name, 'phone', v_patient.phone);
end
$fn$;

-- Token tautan yang masih hidup, untuk dikirim ulang. NULL bila tautan lama (dibuat sebelum migrasi ini).
create or replace function public.portal_get_link_token(p_link_id uuid)
returns text
language plpgsql security definer stable
set search_path = public, extensions
as $fn$
declare
  v_role text := get_my_role();
  v_link public.patient_portal_links%rowtype;
begin
  if v_role is null or v_role not in ('super_admin','owner','admin','clinic_admin','therapist') then
    raise exception 'Tidak berwenang' using errcode = '42501';
  end if;
  select * into v_link from public.patient_portal_links where id = p_link_id;
  if not found or (v_role <> 'super_admin' and v_link.clinic_id is distinct from get_my_clinic_id()) then
    raise exception 'Tautan tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_link.status = 'revoked' then
    return null;
  end if;
  return v_link.token_plain;
end
$fn$;

revoke all on function public.portal_get_link_token(uuid) from public, anon;
grant execute on function public.portal_get_link_token(uuid) to authenticated;
