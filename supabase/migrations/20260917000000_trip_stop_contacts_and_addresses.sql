-- A trip_stop's own maps link was often not enough to actually organise a pickup/drop-off in
-- practice: a company needs a plain-text address to show at a glance (a "basic widget", no
-- geocoding — the Maps link stays the source of truth for navigation), and real animal handovers
-- regularly involve more than the one pickup/one drop-off contact already modelled — e.g. a
-- breeder AND the person physically meeting the van, sometimes a third. Rather than widen
-- trip_stops with more and more flat contact columns, this adds a proper child table so a stop can
-- carry as many extra contacts as a real handover needs, each with a free-text role label and an
-- optional messenger handle (WhatsApp/Messenger name) for reference.

alter table public.trip_stops
  add column pickup_address_text text,
  add column dropoff_address_text text;

create table public.trip_stop_contacts (
  id uuid primary key default gen_random_uuid(),
  trip_stop_id uuid not null references public.trip_stops(id) on delete cascade,
  -- Free text, not an enum — real roles vary ("Breeder", "Recipient", "Neighbour holding the
  -- dog", "Backup contact") and a fixed list would just get an "other" bucket anyway.
  role_label text,
  contact_name text not null,
  contact_phone text,
  messenger_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trip_stop_contacts_trip_stop_id_idx on public.trip_stop_contacts(trip_stop_id);

alter table public.trip_stop_contacts enable row level security;

-- Same "reach the owning org through the parent" shape as trip_stops' own policy (trip_stops ->
-- trips -> is_org_member), one join deeper.
create policy "org members manage contacts on their own trip stops" on public.trip_stop_contacts
  for all to authenticated
  using (exists (
    select 1 from public.trip_stops ts
    join public.trips t on t.id = ts.trip_id
    where ts.id = trip_stop_contacts.trip_stop_id and public.is_org_member(t.organization_id)
  ))
  with check (exists (
    select 1 from public.trip_stops ts
    join public.trips t on t.id = ts.trip_id
    where ts.id = trip_stop_contacts.trip_stop_id and public.is_org_member(t.organization_id)
  ));

create policy "admins manage all trip stop contacts" on public.trip_stop_contacts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.trip_stop_contacts from public, anon;
grant select, insert, update, delete on public.trip_stop_contacts to authenticated;

create trigger set_trip_stop_contacts_updated_at
  before update on public.trip_stop_contacts
  for each row execute function public.set_updated_at();
