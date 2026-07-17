create type public.incident_type as enum (
  'delay', 'vehicle_breakdown', 'animal_welfare_concern', 'accident', 'document_issue', 'weather', 'other'
);
create type public.incident_severity as enum ('low', 'medium', 'high', 'critical');
create type public.incident_status as enum ('open', 'investigating', 'resolved');

create table public.transport_incidents (
  id uuid primary key default gen_random_uuid(),
  transport_request_id uuid not null references public.transport_requests (id) on delete cascade,
  reported_by uuid not null references public.profiles (id),
  incident_type public.incident_type not null,
  severity public.incident_severity not null default 'low',
  description text not null,
  status public.incident_status not null default 'open',
  resolution_notes text,
  occurred_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.transport_incidents enable row level security;

-- Reported by the assigned driver or ops staff — not the customer (incidents are an operational
-- record, communicated to the customer in plain language via transport_status_history's
-- customer_note if and when it actually affects them, never shown as a raw incident record).
create policy "assigned drivers report incidents on their own jobs"
  on public.transport_incidents for insert
  to authenticated
  with check (
    reported_by = (select auth.uid())
    and public.is_assigned_driver_for_request(transport_request_id)
  );

create policy "assigned drivers view incidents they reported"
  on public.transport_incidents for select
  to authenticated
  using (reported_by = (select auth.uid()));

create policy "ops staff manage all incidents"
  on public.transport_incidents for all
  to authenticated
  using (public.is_ops_staff())
  with check (public.is_ops_staff());

grant select, insert, update, delete on public.transport_incidents to authenticated;
