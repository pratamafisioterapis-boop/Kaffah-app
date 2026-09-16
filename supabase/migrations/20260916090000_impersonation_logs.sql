-- Audit trail for the super-admin "remote login" (impersonation) feature.
-- Every time a super admin generates a session for another account, a row
-- is written here by the impersonate-user edge function (service role),
-- so there is always a record of who accessed which account and when.

create table if not exists public.impersonation_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  admin_email text,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  target_email text,
  created_at timestamptz not null default now()
);

create index if not exists impersonation_logs_admin_id_idx on public.impersonation_logs (admin_id);
create index if not exists impersonation_logs_target_user_id_idx on public.impersonation_logs (target_user_id);
create index if not exists impersonation_logs_created_at_idx on public.impersonation_logs (created_at desc);

alter table public.impersonation_logs enable row level security;

-- Only the edge function (service role) writes rows.
create policy "Service role full access impersonation_logs"
  on public.impersonation_logs
  for all
  to service_role
  using (true)
  with check (true);

-- Super admins can review the audit trail from the app.
create policy "Super admin can view impersonation logs"
  on public.impersonation_logs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'super_admin'
    )
  );
