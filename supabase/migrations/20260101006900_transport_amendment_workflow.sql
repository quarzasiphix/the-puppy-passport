-- docs/adr/TRANSPORT_DATA_MODEL.md: nothing today stops a customer from directly editing their own
-- transport_requests row's booking-time snapshot fields (animal/route/compliance/declaration
-- columns) after operations has already started acting on it — confirmed this was never actually
-- exploited by real UI (the only customer-facing writes are the draft form and
-- respondToQuotation(), which only ever touches `status`), but it was never closed either. This
-- adds the same kind of column-lock trigger the previous security pass added for the operational
-- fields (20260101006000_lock_transport_request_operational_fields.sql), plus a deliberate
-- amendment workflow so a legitimate post-submission change (the task's example: "changed contact
-- details after booking") has a real path that doesn't require bypassing the lock.

create or replace function public.prevent_customer_snapshot_changes_after_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_snapshot jsonb;
  v_new_snapshot jsonb;
begin
  -- Same three exemptions as the operational-field lock trigger: a direct superuser/service
  -- connection (migrations/seed), ops staff, or the specific driver already assigned to this exact
  -- request.
  if auth.uid() is null or public.is_ops_staff() or public.is_assigned_driver_for_request(old.id) then
    return new;
  end if;

  -- Unrestricted while still a draft — matches every existing draft-editing flow.
  if old.status = 'draft' then
    return new;
  end if;

  -- Compare everything except the columns the *other* trigger already governs (status,
  -- compliance_review_result, visibility, assigned_*) and pure bookkeeping columns
  -- (updated_at/request_number never legitimately change by direct customer action anyway) — so the
  -- two triggers stay cleanly layered instead of one accidentally re-blocking what the other
  -- explicitly allows.
  v_old_snapshot := to_jsonb(old) - array[
    'status', 'compliance_review_result', 'visibility',
    'assigned_route_id', 'assigned_vehicle_id', 'assigned_driver_id',
    'updated_at', 'request_number'
  ];
  v_new_snapshot := to_jsonb(new) - array[
    'status', 'compliance_review_result', 'visibility',
    'assigned_route_id', 'assigned_vehicle_id', 'assigned_driver_id',
    'updated_at', 'request_number'
  ];

  if v_old_snapshot is distinct from v_new_snapshot then
    raise exception 'This request has already been submitted — its details are locked. Use an amendment request instead of editing directly.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger prevent_customer_snapshot_changes_after_submission
  before update on public.transport_requests
  for each row execute function public.prevent_customer_snapshot_changes_after_submission();

-- The deliberate amendment path: a customer proposes a change to one of a fixed, narrow set of
-- fields most likely to genuinely need changing after booking (contact/address/date details — the
-- task's own example), ops reviews and either applies it or rejects it. field_name is constrained
-- to a fixed allow-list at the database layer, not just in application code, since the review
-- function below builds a dynamic column reference from it.
create type public.transport_amendment_status as enum ('pending', 'approved', 'rejected');

create table public.transport_request_amendments (
  id uuid primary key default gen_random_uuid(),
  transport_request_id uuid not null references public.transport_requests (id) on delete cascade,
  requested_by uuid not null references public.profiles (id),
  field_name text not null check (field_name in (
    'pickup_city', 'pickup_area_approx', 'pickup_address_exact',
    'destination_city', 'destination_area_approx', 'destination_address_exact',
    'earliest_date', 'latest_date',
    'release_authorized_by', 'receive_authorized_by'
  )),
  old_value text,
  new_value text not null,
  status public.transport_amendment_status not null default 'pending',
  review_note text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.transport_request_amendments enable row level security;

create policy "requesters view their own amendments"
  on public.transport_request_amendments for select
  to authenticated
  using (
    exists (
      select 1 from public.transport_requests tr
      where tr.id = transport_request_id and tr.requester_profile_id = (select auth.uid())
    )
  );

-- Deliberately no UPDATE policy for the requester — they can file a request and see its outcome,
-- never self-approve. Insertion happens through request_transport_amendment() below (SECURITY
-- DEFINER, so it doesn't strictly need a direct table INSERT policy for the requester, but one is
-- still added for defense in depth / consistency with every other "requester manages their own X"
-- table in this schema).
create policy "requesters create amendments on their own request"
  on public.transport_request_amendments for insert
  to authenticated
  with check (
    requested_by = (select auth.uid())
    and exists (
      select 1 from public.transport_requests tr
      where tr.id = transport_request_id and tr.requester_profile_id = (select auth.uid())
    )
  );

create policy "ops staff manage all amendments"
  on public.transport_request_amendments for all
  to authenticated
  using (public.is_ops_staff())
  with check (public.is_ops_staff());

grant select, insert, update, delete on public.transport_request_amendments to authenticated;

create or replace function public.request_transport_amendment(
  p_transport_request_id uuid,
  p_field_name text,
  p_new_value text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester uuid := auth.uid();
  v_old_value text;
  v_amendment_id uuid;
begin
  if v_requester is null then
    raise exception 'must be authenticated' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.transport_requests
    where id = p_transport_request_id and requester_profile_id = v_requester
  ) then
    raise exception 'only the requester of this transport request can propose an amendment to it'
      using errcode = 'P0001';
  end if;

  if p_field_name not in (
    'pickup_city', 'pickup_area_approx', 'pickup_address_exact',
    'destination_city', 'destination_area_approx', 'destination_address_exact',
    'earliest_date', 'latest_date',
    'release_authorized_by', 'receive_authorized_by'
  ) then
    raise exception 'field % cannot be amended through this workflow', p_field_name
      using errcode = 'P0001';
  end if;

  execute format('select %I::text from public.transport_requests where id = $1', p_field_name)
    into v_old_value using p_transport_request_id;

  insert into public.transport_request_amendments (
    transport_request_id, requested_by, field_name, old_value, new_value
  ) values (
    p_transport_request_id, v_requester, p_field_name, v_old_value, p_new_value
  )
  returning id into v_amendment_id;

  return v_amendment_id;
end;
$$;

revoke all on function public.request_transport_amendment(uuid, text, text) from public;
grant execute on function public.request_transport_amendment(uuid, text, text) to authenticated;

create or replace function public.review_transport_amendment(
  p_amendment_id uuid,
  p_approve boolean,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amendment public.transport_request_amendments%rowtype;
begin
  if not public.is_ops_staff() then
    raise exception 'only operations staff can review an amendment' using errcode = 'P0001';
  end if;

  select * into v_amendment from public.transport_request_amendments where id = p_amendment_id;
  if not found then
    raise exception 'amendment % not found', p_amendment_id using errcode = 'P0001';
  end if;
  if v_amendment.status != 'pending' then
    raise exception 'amendment % has already been reviewed', p_amendment_id using errcode = 'P0001';
  end if;

  if p_approve then
    -- field_name is guaranteed to be one of the fixed allow-list values by the table's own CHECK
    -- constraint at insert time (immutable thereafter, this table has no UPDATE policy that could
    -- change it) — %I safely quotes it as an identifier, this is not unrestricted dynamic SQL.
    execute format('update public.transport_requests set %I = $1 where id = $2', v_amendment.field_name)
      using v_amendment.new_value, v_amendment.transport_request_id;

    insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
    values (
      auth.uid(), 'transport_request.amendment_approved', 'transport_requests',
      v_amendment.transport_request_id,
      jsonb_build_object('field_name', v_amendment.field_name, 'value', v_amendment.old_value),
      jsonb_build_object('field_name', v_amendment.field_name, 'value', v_amendment.new_value)
    );

    update public.transport_request_amendments
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_review_note
    where id = p_amendment_id;
  else
    insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
    values (
      auth.uid(), 'transport_request.amendment_rejected', 'transport_requests',
      v_amendment.transport_request_id,
      jsonb_build_object('field_name', v_amendment.field_name, 'proposed_value', v_amendment.new_value),
      null
    );

    update public.transport_request_amendments
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_review_note
    where id = p_amendment_id;
  end if;
end;
$$;

revoke all on function public.review_transport_amendment(uuid, boolean, text) from public;
grant execute on function public.review_transport_amendment(uuid, boolean, text) to authenticated;
