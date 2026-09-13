-- Transport-company self-service dispatch: a company can assign one of its OWN drivers/vehicles to
-- a job already routed to its fleet. Extends the fleet-multi-tenancy work
-- (20260912150000_fleet_multi_tenancy.sql), which only ever gave a company read access to its jobs
-- ("a company never writes transport_requests.status directly here" — that migration's own
-- comment). This is the first real write path for a company, deliberately narrow: it can only ever
-- act on a job already assigned to its fleet (mirrors the existing SELECT policy's own condition
-- exactly, so "can see it" and "can dispatch on it" never disagree), and can only ever assign its
-- own drivers/vehicles (organization_id must match) — never grab an unrelated job or plug in
-- another company's driver. assign_driver_to_job()/change_ops_request_status() (ops-staff-only)
-- and advance_transport_job_status() (the individually assigned driver only) are all untouched.

create or replace function public.assign_own_driver_to_job(
  p_request_id uuid,
  p_driver_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_request public.transport_requests%rowtype;
  v_my_org_id uuid;
  v_driver_org_id uuid;
  v_new_status public.transport_status;
begin
  select * into v_request from public.transport_requests where id = p_request_id for update;
  if not found then
    raise exception 'Transport request not found.' using errcode = 'P0002';
  end if;

  -- Which of the caller's own organisations currently has this job, via either its assigned
  -- driver or its assigned vehicle -- mirrors "company members view jobs assigned to their fleet"
  -- exactly, so a company can only ever dispatch a job already routed to them.
  select o.id into v_my_org_id
  from public.organisations o
  where public.is_org_member(o.id)
    and (
      (v_request.assigned_driver_id is not null and exists (
        select 1 from public.drivers d
        where d.id = v_request.assigned_driver_id and d.organization_id = o.id))
      or
      (v_request.assigned_vehicle_id is not null and exists (
        select 1 from public.vehicles veh
        where veh.id = v_request.assigned_vehicle_id and veh.organization_id = o.id))
    )
  limit 1;

  if v_my_org_id is null then
    raise exception 'This job is not assigned to your fleet.' using errcode = '42501';
  end if;

  select organization_id into v_driver_org_id from public.drivers where id = p_driver_id;
  if v_driver_org_id is null or v_driver_org_id <> v_my_org_id then
    raise exception 'That driver does not belong to your own fleet.' using errcode = '42501';
  end if;

  -- Advance to driver_assigned the same way assign_driver_to_job() does, but only from the two
  -- pre-assignment statuses -- never silently rewinds a job already further along (e.g. already
  -- in_transport) just because the company changed which driver is doing it.
  v_new_status := case
    when v_request.status in ('ready_for_scheduling', 'scheduled') then 'driver_assigned'
    else v_request.status
  end;

  update public.transport_requests
  set assigned_driver_id = p_driver_id, status = v_new_status
  where id = p_request_id;

  insert into public.transport_status_history (transport_request_id, status, changed_by)
  values (p_request_id, v_new_status, auth.uid());

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'transport_request.driver_assigned', 'transport_requests', p_request_id,
    jsonb_build_object('assigned_driver_id', v_request.assigned_driver_id, 'status', v_request.status),
    jsonb_build_object('assigned_driver_id', p_driver_id, 'status', v_new_status, 'method', 'company_self_service')
  );
end;
$function$;

revoke all on function public.assign_own_driver_to_job(uuid, uuid) from public, anon;
grant execute on function public.assign_own_driver_to_job(uuid, uuid) to authenticated;

create or replace function public.assign_own_vehicle_to_job(
  p_request_id uuid,
  p_vehicle_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_request public.transport_requests%rowtype;
  v_my_org_id uuid;
  v_vehicle_org_id uuid;
begin
  select * into v_request from public.transport_requests where id = p_request_id for update;
  if not found then
    raise exception 'Transport request not found.' using errcode = 'P0002';
  end if;

  select o.id into v_my_org_id
  from public.organisations o
  where public.is_org_member(o.id)
    and (
      (v_request.assigned_driver_id is not null and exists (
        select 1 from public.drivers d
        where d.id = v_request.assigned_driver_id and d.organization_id = o.id))
      or
      (v_request.assigned_vehicle_id is not null and exists (
        select 1 from public.vehicles veh
        where veh.id = v_request.assigned_vehicle_id and veh.organization_id = o.id))
    )
  limit 1;

  if v_my_org_id is null then
    raise exception 'This job is not assigned to your fleet.' using errcode = '42501';
  end if;

  select organization_id into v_vehicle_org_id from public.vehicles where id = p_vehicle_id;
  if v_vehicle_org_id is null or v_vehicle_org_id <> v_my_org_id then
    raise exception 'That vehicle does not belong to your own fleet.' using errcode = '42501';
  end if;

  update public.transport_requests
  set assigned_vehicle_id = p_vehicle_id
  where id = p_request_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'transport_request.vehicle_assigned', 'transport_requests', p_request_id,
    jsonb_build_object('assigned_vehicle_id', v_request.assigned_vehicle_id),
    jsonb_build_object('assigned_vehicle_id', p_vehicle_id, 'method', 'company_self_service')
  );
end;
$function$;

revoke all on function public.assign_own_vehicle_to_job(uuid, uuid) from public, anon;
grant execute on function public.assign_own_vehicle_to_job(uuid, uuid) to authenticated;
