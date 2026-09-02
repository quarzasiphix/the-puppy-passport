-- Breeder social layer, stage 5: tenant/domain mapping schema ONLY — no DNS provisioning, no
-- certificate issuance, no hostname routing exists yet, and none of that infrastructure is built
-- in this phase (per the product brief: "acceptable to implement standard kennel pages and only
-- document/provide schema boundaries for domains"). This establishes the model so a future
-- subdomain/custom-domain feature is additive, not a schema rewrite.

create type public.organisation_domain_type as enum ('anemalo_subdomain', 'custom_domain');
create type public.organisation_domain_status as enum ('pending', 'verifying', 'active', 'failed', 'disabled');

create table public.organisation_domains (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  hostname text not null,
  type public.organisation_domain_type not null,
  status public.organisation_domain_status not null default 'pending',
  verification_token uuid default gen_random_uuid(),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Basic hostname shape only (real DNS validity is a job for the future verification worker, not
  -- this constraint) — still enough to reject an obviously invalid value at insert time.
  constraint organisation_domains_hostname_format
    check (hostname ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'),
  -- No custom_domain claims a bare *.anemalo.com hostname, and no anemalo_subdomain claims
  -- something that isn't one — kept as a single row-level check rather than two similarly-shaped
  -- constraints that could drift apart later.
  constraint organisation_domains_type_matches_hostname check (
    (type = 'anemalo_subdomain' and hostname like '%.anemalo.com')
    or (type = 'custom_domain' and hostname not like '%.anemalo.com' and hostname <> 'anemalo.com')
  )
);

-- Globally unique — no two kennels may claim the same hostname, on this table or against the
-- reserved list below.
create unique index organisation_domains_hostname_key on public.organisation_domains (hostname);

-- At most one primary domain per kennel (the canonical URL for duplicate-content purposes).
create unique index organisation_domains_one_primary_per_org
  on public.organisation_domains (organisation_id)
  where is_primary;

-- Reserved subdomains no kennel may claim (platform routes, common infra/service names, and
-- obviously-impersonating names) — checked at the database layer, not just in application code,
-- since this table has no public write path anyway but defense in depth costs nothing here.
create or replace function public.reject_reserved_hostname()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
  v_reserved text[] := array[
    'www', 'app', 'api', 'admin', 'mail', 'ftp', 'staging', 'dev', 'test', 'anemalo',
    'support', 'help', 'status', 'blog', 'docs', 'cdn', 'assets', 'static', 'auth',
    'dashboard', 'operations', 'transport', 'security', 'billing'
  ];
begin
  if new.type = 'anemalo_subdomain' then
    v_label := split_part(new.hostname, '.', 1);
    if v_label = any(v_reserved) then
      raise exception 'The subdomain "%" is reserved.', v_label using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger reject_reserved_hostname
  before insert or update of hostname on public.organisation_domains
  for each row execute function public.reject_reserved_hostname();

create trigger set_organisation_domains_updated_at
  before update on public.organisation_domains
  for each row execute function public.set_updated_at();

alter table public.organisation_domains enable row level security;

-- No public SELECT policy: hostname routing/resolution is a future server-side concern (a service-
-- role lookup at the edge, not a client-side PostgREST read), and there is nothing about "which
-- domains exist" that should be broadly readable — matches this schema's own precedent for
-- organisation_invitations ("invitations do not publicly expose membership data").
create policy "org owners manage their kennel's domains"
  on public.organisation_domains for all
  to authenticated
  using (public.owns_org(organisation_id))
  with check (public.owns_org(organisation_id));

create policy "admins manage all kennel domains"
  on public.organisation_domains for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.organisation_domains to authenticated;
