-- The two-way half of the review system: transport_reviews already lets a customer rate the
-- driver (driver_rating), but a driver has never had any way to report back the things only they'd
-- know at handover (was the animal actually as described, was the pickup location accessible, was
-- the paperwork in order). One row per request, written by the individually assigned driver only —
-- same identity check (is_assigned_driver_for_request) already used for that driver's status/
-- incident-reporting rights on this exact request.
create table public.driver_reviews (
  id uuid primary key default gen_random_uuid(),
  transport_request_id uuid not null unique references public.transport_requests (id) on delete cascade,
  reviewer_profile_id uuid not null references public.profiles (id),
  animal_as_described boolean,
  pickup_access_ok boolean,
  paperwork_ok boolean,
  comment text,
  created_at timestamptz not null default now()
);

alter table public.driver_reviews enable row level security;

create policy "assigned drivers manage their own review of a job"
  on public.driver_reviews for all
  to authenticated
  using (
    reviewer_profile_id = (select auth.uid())
    and public.is_assigned_driver_for_request(transport_request_id)
  )
  with check (
    reviewer_profile_id = (select auth.uid())
    and public.is_assigned_driver_for_request(transport_request_id)
  );

create policy "ops staff view all driver reviews"
  on public.driver_reviews for select to authenticated
  using (public.is_ops_staff());

-- Same fleet-visibility shape as transport_reviews (20260920000000) — a transport company can see
-- how its own driver reported back on a job assigned to its fleet.
create policy "company members view driver reviews for their fleet's jobs"
  on public.driver_reviews for select to authenticated
  using (
    exists (
      select 1 from public.transport_requests tr
      where tr.id = transport_request_id
        and (
          (tr.assigned_driver_id is not null and exists (
            select 1 from public.drivers d where d.id = tr.assigned_driver_id
              and d.organization_id is not null and public.is_org_member(d.organization_id)))
          or (tr.assigned_vehicle_id is not null and exists (
            select 1 from public.vehicles v where v.id = tr.assigned_vehicle_id
              and v.organization_id is not null and public.is_org_member(v.organization_id)))
        )
    )
  );

grant select, insert, update, delete on public.driver_reviews to authenticated;
