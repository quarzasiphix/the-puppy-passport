-- Stage XR-7 (append-only queue): transactional workflow boundaries. Auditing every multi-write
-- client-side workflow found `transport_status_history.changed_by` was never actually locked to
-- the real caller for direct table inserts -- a genuine straggler Stage CJD's own "server-controlled
-- actor attribution audit" (20260101011200_actor_attribution_stragglers.sql) missed. That stage
-- fixed `quotations.created_by`/`legal_requirements.created_by` via the same
-- stamp_created_by_actor() trigger this migration mirrors for `changed_by`, but never re-grepped
-- `transport_status_history` itself -- the two already-atomic RPCs
-- (change_ops_request_status()/advance_transport_job_status()) already server-stamp `changed_by =
-- auth.uid()` correctly inside their own function bodies, but every remaining *direct* insert path
-- (the requester's own "log status on their own request" policy, used by respondToQuotation() and
-- createTransportRequest() in src/lib/queries/transport.ts, and the analogous driver/ops direct-
-- insert policies) still trusted a plain client-supplied `changed_by` value with no server check at
-- all -- any authenticated party with insert rights on a given request's history could credit a
-- *different* profile as the one who made the change, the exact forgeable-actor shape this session
-- has closed repeatedly elsewhere (audit_logs.actor_profile_id, notifications.actor_profile_id,
-- quotations.created_by itself).
--
-- A single unconditional BEFORE INSERT trigger closes every current and future direct-insert path
-- at once, the same shape as stamp_created_by_actor(): confirmed safe against every real existing
-- caller by checking every test fixture and the two already-atomic RPCs -- all of them already
-- pass the real calling actor's own id as changed_by, so this is a no-op for every legitimate path
-- and only actually changes behaviour for a genuine forgery attempt. (`supabase/seed.sql` inserts
-- explicit changed_by values directly via psql, outside any authenticated session -- auth.uid() is
-- null there, so those seeded rows' changed_by ends up null after this trigger, exactly the same
-- already-accepted precedent stamp_quotations_created_by already established for seeded
-- quotations.created_by -- confirmed empirically, not assumed: seeded quotations.created_by is
-- already null in the live database today.)
create or replace function public.stamp_changed_by_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.changed_by := auth.uid();
  return new;
end;
$$;

create trigger stamp_transport_status_history_changed_by
  before insert on public.transport_status_history
  for each row execute function public.stamp_changed_by_actor();
