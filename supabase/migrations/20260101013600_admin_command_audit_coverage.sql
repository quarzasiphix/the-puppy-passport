-- Stage YR-7 (admin command catalogue and step-up map, docs/ADMIN_COMMAND_CATALOGUE.md). Building
-- the full catalogue found a real, demonstrated inconsistency: several staff-privileged RPCs
-- (ops/admin/moderator-only) never wrote an audit_logs entry at all, unlike their direct siblings
-- of the same privilege tier that already do (change_ops_request_status, claim_support_case,
-- review_moderation_appeal, set_org_member_status, etc.) -- confirmed against the live database's
-- actual function definitions (pg_get_functiondef), not just migration file text, since several of
-- these were defined or redefined across multiple migrations. Four of the nine are this very
-- session's own new RPCs (assign_driver_to_job, send_quotation, escalate_report_to_case,
-- approve_rehoming_review) -- closing this gap now, not leaving it for a future session to
-- rediscover the same inconsistency in work just committed.
--
-- Every insert below matches the established shape exactly: actor_profile_id always auth.uid()
-- (never client input -- these are all SECURITY DEFINER functions with the auth check already at
-- the top), a `<entity>.<verb>` action name matching this schema's existing naming convention, and
-- before/after values scoped to what's actually useful for reconstructing "what changed" without
-- leaking anything not already visible to admin (audit_logs is admin-read-only). Idempotent-retry
-- early-return paths (already-approved review, already-escalated report, already-assigned driver)
-- deliberately do NOT insert a second audit entry -- an audit log should reflect the one real state
-- transition, not every client retry of it.

create or replace function public.assign_request_to_route(
  p_route_id uuid,
  p_transport_request_id uuid,
  p_compatibility_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment_id uuid;
begin
  if not public.is_ops_staff() then
    raise exception 'Only operations staff can assign a transport request to a route.'
      using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.routes where id = p_route_id) then
    raise exception 'Route not found';
  end if;
  if not exists (select 1 from public.transport_requests where id = p_transport_request_id) then
    raise exception 'Transport request not found';
  end if;

  insert into public.route_assignments (
    route_id, transport_request_id, compatibility_checked, compatibility_notes, assigned_by
  ) values (
    p_route_id, p_transport_request_id, true, p_compatibility_notes, auth.uid()
  )
  returning id into v_assignment_id;

  update public.transport_requests
  set assigned_route_id = p_route_id
  where id = p_transport_request_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, after)
  values (
    auth.uid(), 'transport_request.route_assigned', 'transport_requests', p_transport_request_id,
    jsonb_build_object('route_id', p_route_id, 'route_assignment_id', v_assignment_id)
  );

  return v_assignment_id;
end;
$$;

create or replace function public.assign_driver_to_job(
  p_transport_request_id uuid,
  p_driver_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.transport_requests;
begin
  if not public.is_ops_staff() then
    raise exception 'only operations staff can assign a driver' using errcode = 'P0001';
  end if;

  select * into v_current from public.transport_requests where id = p_transport_request_id;
  if not found then
    raise exception 'transport request not found' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.drivers where id = p_driver_id) then
    raise exception 'driver not found' using errcode = 'P0001';
  end if;

  if v_current.assigned_driver_id = p_driver_id and v_current.status = 'driver_assigned' then
    return;
  end if;

  update public.transport_requests
  set assigned_driver_id = p_driver_id, status = 'driver_assigned'
  where id = p_transport_request_id;

  insert into public.transport_status_history (
    transport_request_id, status, changed_by
  ) values (
    p_transport_request_id, 'driver_assigned', auth.uid()
  );

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'transport_request.driver_assigned', 'transport_requests', p_transport_request_id,
    jsonb_build_object('assigned_driver_id', v_current.assigned_driver_id),
    jsonb_build_object('assigned_driver_id', p_driver_id)
  );
end;
$$;

create or replace function public.send_quotation(p_quotation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quotation public.quotations;
begin
  if not public.is_ops_staff() then
    raise exception 'only operations staff can send a quotation' using errcode = 'P0001';
  end if;

  select * into v_quotation from public.quotations where id = p_quotation_id;
  if not found then
    raise exception 'quotation not found' using errcode = 'P0001';
  end if;

  if v_quotation.status <> 'draft' then
    return;
  end if;

  update public.quotations set status = 'sent' where id = p_quotation_id;

  update public.transport_requests set status = 'quotation_sent'
  where id = v_quotation.transport_request_id;

  insert into public.transport_status_history (
    transport_request_id, status, changed_by, customer_note
  ) values (
    v_quotation.transport_request_id, 'quotation_sent', auth.uid(),
    'A quotation is ready for you to review.'
  );

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'quotation.sent', 'quotations', p_quotation_id,
    jsonb_build_object('status', 'draft'), jsonb_build_object('status', 'sent')
  );
end;
$$;

create or replace function public.approve_user_verification(
  p_verification_id uuid,
  p_admin_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ver public.user_verifications;
  v_org_id uuid;
  v_slug text;
  v_org_type public.org_type;
  v_role public.platform_role;
begin
  if not public.is_admin() then
    raise exception 'only admins can approve verifications';
  end if;

  select * into v_ver from public.user_verifications where id = p_verification_id for update;
  if not found then
    raise exception 'verification % not found', p_verification_id;
  end if;

  if v_ver.status = 'approved' then
    raise exception 'This verification has already been approved.'
      using errcode = 'P0001';
  end if;

  if v_ver.verification_type in ('breeder', 'organisation') then
    v_org_type := coalesce((v_ver.submitted_data ->> 'org_type')::public.org_type, 'kennel');
    v_slug := lower(regexp_replace(v_ver.submitted_data ->> 'name', '[^a-zA-Z0-9]+', '-', 'g'))
      || '-' || substr(v_ver.id::text, 1, 8);

    insert into public.organisations (
      org_type, name, slug, description, country, city, public_location, association_name,
      membership_number, years_experience, verification_status, is_public, owner_user_id
    ) values (
      v_org_type, v_ver.submitted_data ->> 'name', v_slug, v_ver.submitted_data ->> 'description',
      v_ver.submitted_data ->> 'country', v_ver.submitted_data ->> 'city',
      v_ver.submitted_data ->> 'public_location', v_ver.submitted_data ->> 'association_name',
      v_ver.submitted_data ->> 'membership_number',
      nullif(v_ver.submitted_data ->> 'years_experience', '')::integer,
      'approved', true, v_ver.user_id
    )
    returning id into v_org_id;

    insert into public.organisation_members (org_id, profile_id, member_role)
    values (v_org_id, v_ver.user_id, 'owner');

    v_role := case
      when v_ver.verification_type = 'breeder' then 'breeder'
      when v_org_type = 'shelter' then 'shelter_member'
      else 'foundation_member'
    end;
  elsif v_ver.verification_type = 'driver' then
    v_role := 'driver';
  elsif v_ver.verification_type = 'transport_employee' then
    v_role := 'operations';
  else
    v_role := null;
  end if;

  if v_role is not null then
    insert into public.user_roles (user_id, role, status)
    values (v_ver.user_id, v_role, 'active')
    on conflict (user_id, role) do update set status = 'active';
  end if;

  update public.user_verifications
  set status = 'approved', notes = coalesce(p_admin_notes, notes), reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_verification_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'user_verification.approved', 'user_verifications', p_verification_id,
    jsonb_build_object('status', v_ver.status),
    jsonb_build_object('status', 'approved', 'organisation_id', v_org_id, 'granted_role', v_role)
  );

  return v_org_id;
end;
$$;

create or replace function public.mark_risk_signal_reviewed(
  p_signal_id uuid,
  p_is_false_positive boolean,
  p_resolution_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_ops_staff() then
    raise exception 'Only ops staff can review a risk signal.'
      using errcode = 'P0001';
  end if;

  update public.risk_signals
  set reviewed = true,
      is_false_positive = p_is_false_positive,
      resolution_notes = p_resolution_notes,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_signal_id;

  if not found then
    raise exception 'Risk signal not found';
  end if;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, after)
  values (
    auth.uid(), 'risk_signal.reviewed', 'risk_signals', p_signal_id,
    jsonb_build_object('is_false_positive', p_is_false_positive)
  );
end;
$$;

create or replace function public.claim_moderation_case(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_assignee uuid;
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can claim a case.'
      using errcode = 'P0001';
  end if;

  select assigned_moderator_id into v_current_assignee
  from public.moderation_cases
  where id = p_case_id
  for update;

  if not found then
    raise exception 'Moderation case not found';
  end if;

  if v_current_assignee is not null and v_current_assignee <> auth.uid() then
    raise exception 'This case has already been claimed by another moderator.'
      using errcode = 'P0001';
  end if;

  update public.moderation_cases
  set assigned_moderator_id = auth.uid(), status = 'investigating'
  where id = p_case_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'moderation_case.claimed', 'moderation_cases', p_case_id,
    jsonb_build_object('assigned_moderator_id', v_current_assignee),
    jsonb_build_object('assigned_moderator_id', auth.uid())
  );
end;
$$;

create or replace function public.escalate_report_to_case(p_report_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports;
  v_existing_case_id uuid;
  v_case_id uuid;
begin
  if not public.is_moderator() then
    raise exception 'only a moderator can escalate a report' using errcode = 'P0001';
  end if;

  select * into v_report from public.reports where id = p_report_id;
  if not found then
    raise exception 'report not found' using errcode = 'P0001';
  end if;

  if v_report.status = 'escalated' then
    select id into v_existing_case_id
    from public.moderation_cases
    where report_id = p_report_id
    order by created_at desc
    limit 1;
    if v_existing_case_id is not null then
      return v_existing_case_id;
    end if;
  end if;

  insert into public.moderation_cases (report_id, case_type, target_type, target_id, status)
  values (p_report_id, 'report_escalation', v_report.target_type, v_report.target_id, 'open')
  returning id into v_case_id;

  update public.reports set status = 'escalated' where id = p_report_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, after)
  values (
    auth.uid(), 'report.escalated', 'reports', p_report_id,
    jsonb_build_object('moderation_case_id', v_case_id)
  );

  return v_case_id;
end;
$$;

create or replace function public.approve_rehoming_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.rehoming_reviews;
begin
  if not public.is_admin() then
    raise exception 'only an admin can approve a rehoming review' using errcode = 'P0001';
  end if;

  select * into v_review from public.rehoming_reviews where id = p_review_id;
  if not found then
    raise exception 'rehoming review not found' using errcode = 'P0001';
  end if;

  if v_review.admin_status = 'approved' then
    return;
  end if;

  update public.rehoming_reviews
  set admin_status = 'approved', reviewed_at = now()
  where id = p_review_id;

  update public.animals set availability_status = 'available' where id = v_review.animal_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'rehoming_review.approved', 'rehoming_reviews', p_review_id,
    jsonb_build_object('admin_status', v_review.admin_status),
    jsonb_build_object('admin_status', 'approved')
  );
end;
$$;

create or replace function public.convert_application_to_reservation(
  p_application_id uuid,
  p_agreed_price numeric default null,
  p_currency text default 'PLN',
  p_planned_collection_date date default null,
  p_collection_method public.collection_method default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.buyer_applications;
  v_existing public.reservations;
  v_reservation_id uuid;
begin
  select * into v_application from public.buyer_applications where id = p_application_id;
  if not found then
    raise exception 'Application not found' using errcode = 'P0001';
  end if;

  if v_application.organization_id is null then
    raise exception 'This application has no organisation to reserve on behalf of.'
      using errcode = 'P0001';
  end if;

  if not public.owns_org(v_application.organization_id) and not public.is_admin() then
    raise exception 'Only the organisation this application was submitted to can convert it to a reservation.'
      using errcode = 'P0001';
  end if;

  select * into v_existing from public.reservations where application_id = p_application_id;
  if found then
    if v_existing.agreed_price is distinct from p_agreed_price
       or v_existing.currency is distinct from p_currency
       or v_existing.planned_collection_date is distinct from p_planned_collection_date
       or v_existing.collection_method is distinct from p_collection_method then
      raise exception 'This application was already converted to a reservation with different terms — refresh and try again.'
        using errcode = 'P0001';
    end if;
    return v_existing.id;
  end if;

  if v_application.status <> 'approved' then
    raise exception 'Only an approved application can be converted to a reservation.'
      using errcode = 'P0001';
  end if;

  begin
    insert into public.reservations (
      animal_id, litter_id, buyer_id, organization_id, application_id,
      agreed_price, currency, planned_collection_date, collection_method, notes
    )
    values (
      v_application.animal_id, v_application.litter_id, v_application.buyer_id,
      v_application.organization_id, p_application_id,
      p_agreed_price, p_currency, p_planned_collection_date, p_collection_method, p_notes
    )
    returning id into v_reservation_id;
  exception when unique_violation then
    select * into v_existing from public.reservations where application_id = p_application_id;
    if v_existing.agreed_price is distinct from p_agreed_price
       or v_existing.currency is distinct from p_currency
       or v_existing.planned_collection_date is distinct from p_planned_collection_date
       or v_existing.collection_method is distinct from p_collection_method then
      raise exception 'This application was already converted to a reservation with different terms — refresh and try again.'
        using errcode = 'P0001';
    end if;
    return v_existing.id;
  end;

  update public.buyer_applications set status = 'converted_to_reservation'
  where id = p_application_id;

  update public.animals set availability_status = 'reserved'
  where id = v_application.animal_id
    and availability_status in ('available', 'applications_open');

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, after)
  values (
    auth.uid(), 'buyer_application.converted_to_reservation', 'buyer_applications', p_application_id,
    jsonb_build_object('reservation_id', v_reservation_id, 'agreed_price', p_agreed_price, 'currency', p_currency)
  );

  return v_reservation_id;
end;
$$;
