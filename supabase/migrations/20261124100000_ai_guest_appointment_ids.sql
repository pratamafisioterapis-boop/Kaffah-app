-- Cari jadwal tamu (guest) berdasarkan nomor WhatsApp dengan mengabaikan tanda baca di appointments.guest_phone
-- (mis. "0815-2269-9732"). Dipakai fungsi edge AI WhatsApp; hanya service_role.
create or replace function public.ai_guest_appointment_ids(p_clinic_id uuid, p_wa_id text, p_since timestamptz)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.id
  from appointments a
  where a.clinic_id = p_clinic_id
    and a.guest_phone is not null
    and a.appointment_date >= p_since
    and length(regexp_replace(coalesce(p_wa_id, ''), '\D', '', 'g')) >= 9
    and right(regexp_replace(a.guest_phone, '\D', '', 'g'), 9) = right(regexp_replace(p_wa_id, '\D', '', 'g'), 9)
  order by a.appointment_date
  limit 20;
$$;
revoke all on function public.ai_guest_appointment_ids(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.ai_guest_appointment_ids(uuid, text, timestamptz) to service_role;
