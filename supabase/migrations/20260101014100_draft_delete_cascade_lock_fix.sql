-- Found while fixing a test-suite hygiene bug (unchecked cleanup-delete errors in
-- tests/db/adoption-questionnaire.test.ts): the documented, RLS-backed feature "requesters delete
-- their own draft requests" (20260101002400_animals_transport_fields.sql: `on public.
-- transport_requests for delete using (requester_profile_id = auth.uid() and status = 'draft')`)
-- was completely broken for any draft that has animals or parties attached -- which is the normal
-- case, since create_transport_draft() always inserts both.
--
-- Root cause: 20260101007000_transport_animal_and_party_lock_after_draft.sql's
-- prevent_animal_and_party_changes_after_draft() trigger fires (before insert/update/delete) on
-- transport_request_animals/transport_parties, and looks up the parent transport_requests row's
-- current status to decide whether to allow the change. When a requester deletes their own
-- transport_requests row, Postgres processes the parent DELETE first, then (same transaction) the
-- ON DELETE CASCADE fires on the child rows -- by which point the parent row no longer exists, so
-- `select status into v_status from transport_requests where id = v_request_id` finds nothing and
-- v_status is null. `null is distinct from 'draft'` evaluates true, so the trigger always raised
-- its "can no longer be edited directly once it has left draft" exception -- even though the
-- parent's own deletion could only have succeeded while status = 'draft' in the first place (that
-- is exactly what its own RLS policy requires).
--
-- Confirmed genuinely reachable, not hypothetical: tests/db/adoption-questionnaire.test.ts's own
-- "approved adoption application connects to a real transport draft" test creates a request via
-- create_transport_draft() (which always inserts animals+parties) and its cleanup step deletes
-- that request directly -- this delete has been silently failing every single run since that test
-- was written, invisible only because the delete's .error was never checked until this fix.
--
-- Fix: a direct child-row delete/insert/update can never observe a missing parent (the foreign key
-- requires it to exist), so "TG_OP = 'DELETE' and the parent is now missing" can only mean this
-- call arrived via cascade from the parent's own (already-authorized) deletion. Allow that case
-- without re-checking a status that no longer exists to check; every other case is unchanged.
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
  if auth.uid() is null or public.is_ops_staff() then
    return coalesce(new, old);
  end if;

  select status into v_status from public.transport_requests where id = v_request_id;

  if TG_OP = 'DELETE' and v_status is null then
    return old;
  end if;

  if v_status is distinct from 'draft' then
    raise exception 'This request''s animals and parties can no longer be edited directly once it has left draft — use request_transport_amendment() to propose a change for operations review'
      using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;
