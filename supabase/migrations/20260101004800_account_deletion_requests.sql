-- Client-side code can never delete an auth.users row (that needs the service-role key, which
-- never reaches the browser) — so "delete my account" is honestly a *request*, reviewed and
-- actioned by an admin, not an instant self-service action. This table is that request queue.
create type public.account_deletion_status as enum ('pending', 'processed', 'declined');

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reason text,
  status public.account_deletion_status not null default 'pending',
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references public.profiles (id)
);

alter table public.account_deletion_requests enable row level security;

create policy "users manage their own deletion request"
  on public.account_deletion_requests for all
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "admins manage all deletion requests"
  on public.account_deletion_requests for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.account_deletion_requests to authenticated;
