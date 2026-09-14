-- "Saved clients" — a reusable pickup/dropoff contact an operator or transport company can come
-- back to instead of retyping the same breeder's phone number on every stop. Deliberately NOT the
-- heavyweight organisations table (verification workflow, slug, ownership — meant for real
-- platform accounts), since most pickup/dropoff contacts are private individuals or a breeder who
-- may not have (or want) any Anemalo account at all.
create table public.transport_contacts (
  id uuid primary key default gen_random_uuid(),
  -- null = ops-wide shared address book; a real id = that transport company's own, private list.
  organization_id uuid references public.organisations(id),
  name text not null,
  phone text,
  email text,
  -- Free text, not an enum — same "roles vary too much for a fixed list" reasoning
  -- trip_stop_contacts.role_label already uses.
  role_label text,
  city text,
  country text,
  notes text,
  -- Set only if this contact happens to already be a real registered breeder/foundation —
  -- optional cross-reference, never required.
  linked_organisation_id uuid references public.organisations(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transport_contacts_organization_id_idx on public.transport_contacts(organization_id);

alter table public.transport_contacts enable row level security;

create policy "ops staff manage all contacts" on public.transport_contacts
  for all to authenticated using (public.is_ops_staff()) with check (public.is_ops_staff());

create policy "company members manage their own contacts" on public.transport_contacts
  for all to authenticated
  using (organization_id is not null and public.is_org_member(organization_id))
  with check (organization_id is not null and public.is_org_member(organization_id));

-- Read-only access to the ops-wide shared book, restricted to transport-company members (not
-- every authenticated user) since these rows carry private individuals' phone numbers/emails.
create policy "transport company members view shared contacts" on public.transport_contacts
  for select to authenticated
  using (
    organization_id is null
    and exists (
      select 1 from public.organisation_members om
      join public.organisations o on o.id = om.org_id
      where om.profile_id = (select auth.uid())
        and om.status = 'active'
        and o.org_type = 'transport_company'
    )
  );

revoke all on public.transport_contacts from public, anon;
grant select, insert, update, delete on public.transport_contacts to authenticated;

create trigger set_transport_contacts_updated_at
  before update on public.transport_contacts
  for each row execute function public.set_updated_at();
