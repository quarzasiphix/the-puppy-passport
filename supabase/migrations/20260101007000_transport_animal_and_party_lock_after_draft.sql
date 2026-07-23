-- docs/adr/TRANSPORT_DATA_MODEL.md + 20260101006900_transport_amendment_workflow.sql: that
-- migration locks transport_requests' own snapshot columns once a request leaves 'draft' and adds
-- the amendment workflow for changing them afterwards. It does not touch transport_request_animals
-- or transport_parties, which still grant the requester unconditional insert/update/delete on their
-- own request's rows ("requesters manage animals/parties on their own request",
-- 20260101006500/20260101006600) — RLS alone can't express "only while the parent request is still
-- a draft." Without this, a requester could bypass the transport_requests-column lock entirely by
-- adding, editing or deleting an animal or party row directly on an already-submitted request.
create or replace function public.prevent_animal_and_party_changes_after_draft()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid := coalesce(new.transport_request_id, old.transport_request_id);
  v_status public.transport_status;
begin
  -- Same three exemptions as the sibling snapshot-lock trigger on transport_requests itself
  -- (20260101006900): a direct superuser/service connection (migrations/seed) or ops staff.
  if auth.uid() is null or public.is_ops_staff() then
    return coalesce(new, old);
  end if;

  select status into v_status from public.transport_requests where id = v_request_id;

  if v_status is distinct from 'draft' then
    raise exception 'This request''s animals and parties can no longer be edited directly once it has left draft — use request_transport_amendment() to propose a change for operations review'
      using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger prevent_animal_changes_after_draft
  before insert or update or delete on public.transport_request_animals
  for each row execute function public.prevent_animal_and_party_changes_after_draft();

create trigger prevent_party_changes_after_draft
  before insert or update or delete on public.transport_parties
  for each row execute function public.prevent_animal_and_party_changes_after_draft();
