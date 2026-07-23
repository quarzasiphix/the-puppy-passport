-- Stage D: urgent animal welfare / rescue transport. dashboard.foundation.urgent.tsx was an honest
-- NotImplemented placeholder ("Flag welfare-urgent animals... a flag here does not itself grant
-- transport priority" — that framing is kept verbatim below). Eligible creators are restricted to
-- verified foundation/shelter/rescue organisations, matching the same org_type + verification_status
-- gate already used for adoption listings (20260101000900_animals.sql) — an ordinary user or a
-- kennel cannot create a welfare case.
create type public.welfare_case_urgency as enum ('routine', 'urgent', 'critical');
create type public.welfare_case_status as enum (
  'draft', 'submitted', 'under_review', 'information_required',
  'accepted_for_assessment', 'declined', 'converted_to_transport', 'closed'
);

create table public.welfare_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text unique,
  organisation_id uuid not null references public.organisations (id),
  created_by uuid not null references public.profiles (id),
  -- animal_id optional (an external/not-yet-registered animal is common in a rescue intake); the
  -- snapshot fields always carry what the case actually says, same "registered or snapshot" shape
  -- transport_request_animals already uses.
  animal_id uuid references public.animals (id) on delete set null,
  animal_name text,
  animal_description text,
  reason text not null,
  urgency public.welfare_case_urgency not null default 'urgent',
  location_country text,
  location_city text,
  location_area_approx text,
  location_address_exact text,
  destination_country text,
  destination_city text,
  deadline date,
  welfare_notes text,
  contact_name text,
  contact_phone text,
  status public.welfare_case_status not null default 'draft',
  ops_acknowledged boolean not null default false,
  ops_acknowledged_by uuid references public.profiles (id),
  ops_acknowledged_at timestamptz,
  -- Internal-only review notes — never selected for the organisation's own view (same discipline
  -- as transport_status_history.internal_note / moderation_cases.decision_explanation).
  review_notes text,
  converted_transport_request_id uuid references public.transport_requests (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_welfare_cases_updated_at
  before update on public.welfare_cases
  for each row execute function public.set_updated_at();

create sequence public.welfare_case_number_seq;

create or replace function public.set_welfare_case_number()
returns trigger
language plpgsql
as $$
begin
  if new.case_number is null then
    new.case_number := 'WC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.welfare_case_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create trigger set_welfare_cases_number
  before insert on public.welfare_cases
  for each row execute function public.set_welfare_case_number();

alter table public.welfare_cases enable row level security;

-- Only a member of a verified foundation/shelter/rescue organisation may create a case for that
-- organisation — checked directly against the live organisations row, not a client-supplied flag.
create policy "eligible org members create welfare cases for their own org"
  on public.welfare_cases for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.organisations o
      where o.id = organisation_id
        and o.org_type in ('foundation', 'shelter', 'rescue')
        and o.verification_status = 'approved'
        and public.is_org_member(o.id)
    )
  );

create policy "org members view and edit their own org's welfare cases"
  on public.welfare_cases for select
  to authenticated
  using (public.is_org_member(organisation_id));

-- Editing (not creating, not deleting) is allowed while a case hasn't yet reached a final/ops-owned
-- state — mirrors the transport-request draft-editing pattern (only 'draft'/'submitted'/
-- 'information_required' are genuinely still the organisation's own to change).
create policy "org members edit their own org's case before ops decision"
  on public.welfare_cases for update
  to authenticated
  using (
    public.is_org_member(organisation_id)
    and status in ('draft', 'submitted', 'information_required')
  )
  with check (
    public.is_org_member(organisation_id)
    and status in ('draft', 'submitted', 'information_required')
  );

create policy "ops staff manage all welfare cases"
  on public.welfare_cases for all
  to authenticated
  using (public.is_ops_staff())
  with check (public.is_ops_staff());

grant select, insert, update on public.welfare_cases to authenticated;

-- Supporting documents (Stage D: "supporting documents"). Same private-Storage-plus-metadata-row
-- shape as transport_documents, since a welfare case has no transport_request_id yet to hang a
-- transport_documents row off — the bucket is intentionally separate (private, org/ops-only),
-- never merged into transport-documents.
create table public.welfare_case_documents (
  id uuid primary key default gen_random_uuid(),
  welfare_case_id uuid not null references public.welfare_cases (id) on delete cascade,
  file_url text not null,
  uploaded_by uuid references public.profiles (id),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.welfare_case_documents enable row level security;

create policy "org members manage documents on their own org's welfare case"
  on public.welfare_case_documents for all
  to authenticated
  using (
    exists (
      select 1 from public.welfare_cases wc
      where wc.id = welfare_case_id and public.is_org_member(wc.organisation_id)
    )
  )
  with check (
    exists (
      select 1 from public.welfare_cases wc
      where wc.id = welfare_case_id and public.is_org_member(wc.organisation_id)
    )
  );

create policy "ops staff manage all welfare case documents"
  on public.welfare_case_documents for all
  to authenticated
  using (public.is_ops_staff())
  with check (public.is_ops_staff());

grant select, insert, update, delete on public.welfare_case_documents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('welfare-case-documents', 'welfare-case-documents', false, 20971520)
on conflict (id) do nothing;

create policy "org members access their welfare case documents in storage"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'welfare-case-documents'
    and exists (
      select 1 from public.welfare_cases wc
      where wc.id = (storage.foldername(name))[1]::uuid and public.is_org_member(wc.organisation_id)
    )
  )
  with check (
    bucket_id = 'welfare-case-documents'
    and exists (
      select 1 from public.welfare_cases wc
      where wc.id = (storage.foldername(name))[1]::uuid and public.is_org_member(wc.organisation_id)
    )
  );

create policy "ops staff manage all welfare case documents in storage"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'welfare-case-documents' and public.is_ops_staff())
  with check (bucket_id = 'welfare-case-documents' and public.is_ops_staff());

-- Ops acknowledges a submitted case — a distinct, explicit action from accepting it for
-- assessment, so "we've seen it" and "we've assessed it" are never conflated (matches the brief's
-- own "urgent does not mean automatically approved").
create or replace function public.acknowledge_welfare_case(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_ops_staff() then
    raise exception 'only operations staff can acknowledge a welfare case' using errcode = 'P0001';
  end if;

  update public.welfare_cases
  set ops_acknowledged = true, ops_acknowledged_by = auth.uid(), ops_acknowledged_at = now()
  where id = p_case_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (auth.uid(), 'welfare_case.acknowledged', 'welfare_cases', p_case_id, null, null);
end;
$$;

revoke all on function public.acknowledge_welfare_case(uuid) from public;
grant execute on function public.acknowledge_welfare_case(uuid) to authenticated;

-- Ops reviews (accept-for-assessment / decline) — the only path that can move a case out of
-- under_review/information_required into a decision state. review_notes are internal-only,
-- exactly mirroring moderation_cases.decision_explanation's "never public" discipline.
create or replace function public.review_welfare_case(
  p_case_id uuid,
  p_decision public.welfare_case_status,
  p_review_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_ops_staff() then
    raise exception 'only operations staff can review a welfare case' using errcode = 'P0001';
  end if;
  if p_decision not in ('accepted_for_assessment', 'declined', 'information_required') then
    raise exception 'decision must be accepted_for_assessment, declined, or information_required'
      using errcode = 'P0001';
  end if;

  update public.welfare_cases
  set status = p_decision, review_notes = coalesce(p_review_notes, review_notes)
  where id = p_case_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'welfare_case.reviewed', 'welfare_cases', p_case_id,
    null, jsonb_build_object('decision', p_decision)
  );
end;
$$;

revoke all on function public.review_welfare_case(uuid, public.welfare_case_status, text) from public;
grant execute on function public.review_welfare_case(uuid, public.welfare_case_status, text) to authenticated;

-- Conversion to a real transport draft — reuses create_transport_draft() rather than inventing a
-- second transport model, exactly as the brief requires. Callable by a member of the case's own
-- organisation (so the resulting transport_requests.requester_profile_id is a genuine org member,
-- matching how the other Phase-5/6 entry points work — "called BY the requester"), but only once
-- ops has already accepted the case for assessment: acceptance is the actual gate, not urgency.
create or replace function public.convert_welfare_case_to_transport_draft(p_case_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.welfare_cases;
  v_request_id uuid;
begin
  select * into v_case from public.welfare_cases where id = p_case_id;
  if not found then
    raise exception 'welfare case not found' using errcode = 'P0001';
  end if;
  if not public.is_org_member(v_case.organisation_id) then
    raise exception 'only a member of this case''s organisation can convert it' using errcode = 'P0001';
  end if;
  if v_case.status <> 'accepted_for_assessment' then
    raise exception 'this case has not been accepted for assessment by operations yet (status: %)', v_case.status
      using errcode = 'P0001';
  end if;

  v_request_id := public.create_transport_draft(
    jsonb_build_object(
      'request_purpose', 'foundation_rescue',
      'pickup_country', v_case.location_country,
      'pickup_city', v_case.location_city,
      'pickup_area_approx', v_case.location_area_approx,
      'pickup_address_exact', v_case.location_address_exact,
      'destination_country', v_case.destination_country,
      'destination_city', v_case.destination_city,
      'latest_date', v_case.deadline,
      'release_authorized_by', v_case.contact_name
    ),
    jsonb_build_array(jsonb_build_object(
      'animal_id', v_case.animal_id,
      'name', v_case.animal_name,
      'behavioural_notes', v_case.animal_description
    )),
    jsonb_build_array(jsonb_build_object('party_role', 'sender', 'organisation_id', v_case.organisation_id))
  );

  update public.welfare_cases
  set status = 'converted_to_transport', converted_transport_request_id = v_request_id
  where id = p_case_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'welfare_case.converted_to_transport', 'welfare_cases', p_case_id,
    null, jsonb_build_object('transport_request_id', v_request_id)
  );

  return v_request_id;
end;
$$;

revoke all on function public.convert_welfare_case_to_transport_draft(uuid) from public;
grant execute on function public.convert_welfare_case_to_transport_draft(uuid) to authenticated;
