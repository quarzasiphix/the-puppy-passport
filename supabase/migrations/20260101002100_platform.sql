create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text,
  link_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles (id),
  action text not null,
  target_type text not null,
  target_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy "users manage their own notifications"
  on public.notifications for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

-- Audit logs are admin-only — they exist to reconstruct "who changed what", not for general
-- consumption, and specifically must not leak internal pricing/decisions to the actor being
-- audited.
create policy "admins read audit logs"
  on public.audit_logs for select to authenticated
  using (public.is_admin());

create policy "ops staff and admins write audit logs"
  on public.audit_logs for insert to authenticated
  with check (public.is_ops_staff());
