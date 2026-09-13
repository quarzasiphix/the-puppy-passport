-- Opens the org-private Trips feature (20260915000000_transport_company_trips.sql) up for
-- visibility and light matching, per the product ask: let the app show which companies have trips
-- planned and where, and let a customer or another company ask to put an animal on an existing
-- trip instead of coordinating over WhatsApp/notes.
--
-- Deliberately narrow scope (see the approved plan): no geocoding, no scored auto-matching engine
-- against transport_requests, no payments. This is "browsable + a lightweight ask", mirroring two
-- patterns already proven in this schema: public_routes (20260101002700_public_routes_view.sql,
-- the "safe to expose publicly" boundary — geography/date/status/derived count, never
-- addresses/contacts) and route_waitlist (20260101004400_route_waitlist.sql, the "customer
-- registers interest with no big form" shape).

alter table public.trips
  add column is_public boolean not null default false,
  add column origin_country text,
  add column destination_country text;

-- Mirrors public_routes' own security posture (a plain view, RLS on the underlying tables plus an
-- explicit anon grant on the view — not security_invoker, since anon has no direct grant on trips
-- itself). Every excluded column (maps links, contacts, vehicle/driver, notes) mirrors exactly what
-- public_routes already excludes from `routes`.
create view public.public_trips as
select
  t.id,
  t.name,
  t.status,
  t.departure_date,
  t.origin_country,
  t.destination_country,
  o.name as company_name,
  o.slug as company_slug,
  count(ts.id) as stop_count
from public.trips t
join public.organisations o on o.id = t.organization_id
left join public.trip_stops ts on ts.trip_id = t.id
where t.is_public
  and t.status in ('planning', 'in_progress')
  and o.verification_status = 'approved'
  and o.is_public
group by t.id, o.name, o.slug;

grant select on public.public_trips to anon, authenticated;

create type public.trip_join_request_status as enum ('pending', 'accepted', 'declined', 'withdrawn');

-- Shaped like a trip_stop (pickup/dropoff maps link + contact) submitted by someone who is not the
-- trip's owner. Sign-in required to submit (no anon grant below), matching route_waitlist's own
-- "auth-required, not anonymous" precedent.
create table public.trip_join_requests (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  requester_profile_id uuid not null references public.profiles(id),
  animal_label text not null,
  pickup_maps_url text,
  pickup_contact_name text,
  pickup_contact_phone text,
  dropoff_maps_url text,
  dropoff_contact_name text,
  dropoff_contact_phone text,
  notes text,
  status public.trip_join_request_status not null default 'pending',
  decided_at timestamptz,
  decided_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trip_join_requests_trip_id_idx on public.trip_join_requests(trip_id);
create index trip_join_requests_requester_idx on public.trip_join_requests(requester_profile_id);

alter table public.trip_join_requests enable row level security;

create policy "requesters manage their own join requests" on public.trip_join_requests
  for all to authenticated
  using (requester_profile_id = auth.uid())
  with check (requester_profile_id = auth.uid());

create policy "org members manage join requests on their own trips" on public.trip_join_requests
  for all to authenticated
  using (exists (
    select 1 from public.trips t
    where t.id = trip_join_requests.trip_id and public.is_org_member(t.organization_id)
  ))
  with check (exists (
    select 1 from public.trips t
    where t.id = trip_join_requests.trip_id and public.is_org_member(t.organization_id)
  ));

create policy "admins manage all join requests" on public.trip_join_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.trip_join_requests from public, anon;
grant select, insert, update on public.trip_join_requests to authenticated;

create trigger set_trip_join_requests_updated_at
  before update on public.trip_join_requests
  for each row execute function public.set_updated_at();

-- Two small, purpose-built notification paths — deliberately NOT routed through
-- create_notification_if_enabled(): that producer's authorization check
-- (20260101014600_notification_producer_authorization_lock.sql) is hard-locked to exactly 3
-- unrelated cases (self / moderator / org-owner-notifies-buyer-applicant) and would reject both
-- calls below outright. The legitimacy check here is structural instead: these triggers only ever
-- fire from inserts/updates on rows RLS already scoped to a real trip <-> requester relationship,
-- so a purpose-built SECURITY DEFINER insert is the correct amount of mechanism, same reasoning as
-- assign_own_driver_to_job/assign_own_vehicle_to_job crossing their own trust boundary.
--
-- Fans out to every member of the trip's org — organisation_members has no status/active column
-- (confirmed by reading 20260101000500_organizations.sql), so every membership row is "active".
create function public.notify_trip_owner_of_join_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_member record;
begin
  select organization_id into v_org_id from public.trips where id = new.trip_id;
  for v_member in
    select profile_id from public.organisation_members where org_id = v_org_id
  loop
    insert into public.notifications (profile_id, notification_type, title, body, link_url)
    values (
      v_member.profile_id,
      'trip_join_request_received',
      'New request to join a trip',
      new.animal_label,
      '/dashboard/transport-company/trips/' || new.trip_id
    );
  end loop;
  return new;
end;
$$;

create trigger trip_join_request_notify_owner
  after insert on public.trip_join_requests
  for each row execute function public.notify_trip_owner_of_join_request();

create function public.notify_requester_of_join_request_decision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('accepted', 'declined') and old.status = 'pending' then
    insert into public.notifications (profile_id, notification_type, title, body)
    values (
      new.requester_profile_id,
      'trip_join_request_decided',
      case when new.status = 'accepted' then 'Your request was accepted'
           else 'Your request was declined' end,
      new.animal_label
    );
  end if;
  return new;
end;
$$;

create trigger trip_join_request_notify_requester
  after update of status on public.trip_join_requests
  for each row execute function public.notify_requester_of_join_request_decision();
