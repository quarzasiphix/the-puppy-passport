-- Stage AE (supplemental queue): audit-log quality.
--
-- 1) "ops staff and admins write audit logs" (20260101002100_platform.sql) only ever checked
-- is_ops_staff(), never that actor_profile_id is the real caller -- any ops/admin account could
-- insert an audit_logs row crediting a *different* profile id as the actor, project-wide (not
-- just the two call sites found so far). Locking this at the RLS layer closes every current and
-- future direct client-side audit_logs insert in one place, the same reasoning as
-- notifications.actor_profile_id being server-stamped in an earlier session.
drop policy "ops staff and admins write audit logs" on public.audit_logs;

create policy "ops staff and admins write audit logs"
  on public.audit_logs for insert
  to authenticated
  with check (public.is_ops_staff() and actor_profile_id = (select auth.uid()));

-- 2) assignRequestToRoute() (src/lib/queries/routes.ts) does two separate client-side writes --
-- insert route_assignments, then update transport_requests.assigned_route_id -- and never checks
-- the second call's error at all. A failure partway through leaves a route_assignments row while
-- transport_requests silently never reflects the assignment, an inconsistent state nothing would
-- surface to the caller. Also trusted a client-supplied assignedBy field for route_assignments.
-- assigned_by, the same forgeable-actor shape closed elsewhere this session. Folded into one
-- atomic SECURITY DEFINER RPC, matching change_ops_request_status() from Stage AD.
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

  return v_assignment_id;
end;
$$;

revoke all on function public.assign_request_to_route(uuid, uuid, text) from public;
grant execute on function public.assign_request_to_route(uuid, uuid, text) to authenticated;
