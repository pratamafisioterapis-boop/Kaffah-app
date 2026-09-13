-- Activity Center (topbar notification bell) needs to mark an audit_logs
-- row as read on click. audit_logs only has an INSERT and a clinic-scoped
-- SELECT policy (it's an audit trail, so it must stay otherwise immutable),
-- so a normal UPDATE policy would let any clinic user rewrite `action`,
-- `changes`, etc. Expose a narrow SECURITY DEFINER RPC that can only ever
-- flip `is_read` on a row belonging to the caller's own clinic instead.

create or replace function public.mark_audit_log_read(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.audit_logs
  set is_read = true
  where id = p_id
    and (clinic_id = get_my_clinic_id() or get_my_role() = 'super_admin');
end;
$$;

grant execute on function public.mark_audit_log_read(uuid) to authenticated;
