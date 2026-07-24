-- Stage CJD (third/fourth supplemental queue): server-controlled actor attribution audit.
-- Systematically re-grepped every `*_by`/`*_profile_id` actor-attribution-style column across the
-- whole schema (13 distinct column names, ~20 tables) against Stage CB's already-documented list
-- and found two real stragglers: `quotations.created_by` and `legal_requirements.created_by` were
-- both still client-insertable, with no RLS check or trigger tying them to the real caller.
--
-- `quotations.created_by` is the real, demonstrated one: `createQuotation()`
-- (src/lib/queries/operations.ts) inserts a client-supplied `created_by` directly, called from a
-- real, live UI (dashboard.operations.quotations.tsx) -- any ops account could currently credit a
-- *different* ops profile as the quotation's creator via a raw API call, the exact forgeable-actor
-- shape this session has closed repeatedly elsewhere. `legal_requirements.created_by` has no real
-- call site at all today (grepped `src/lib/queries/*.ts` -- zero references), but is closed at the
-- same time for the same reason record_risk_signal()/others were: near-zero cost, consistent
-- defense in depth, matching this session's own established bar rather than leaving a known gap
-- "because nothing calls it yet."
create or replace function public.stamp_created_by_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by := auth.uid();
  return new;
end;
$$;

create trigger stamp_quotations_created_by
  before insert on public.quotations
  for each row execute function public.stamp_created_by_actor();

create trigger stamp_legal_requirements_created_by
  before insert on public.legal_requirements
  for each row execute function public.stamp_created_by_actor();
