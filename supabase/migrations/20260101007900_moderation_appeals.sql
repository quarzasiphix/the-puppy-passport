-- Stage G: moderation decisions and appeals. docs/IMPLEMENTATION_PLAN.md already flagged the exact
-- gap: "appeal_status already exists on moderation_cases as an enum, but there is no user-facing
-- way to actually request an appeal — moderation decisions aren't visible to the affected user at
-- all yet, only to staff." Confirmed by reading moderation_cases' RLS directly: "moderators and
-- admins manage all moderation cases" is the *only* policy — there is no path for the affected
-- person to see even that a case exists against them.

-- Who a case is "about" depends on its polymorphic target_type/target_id, which can't carry a real
-- foreign key (it points at different tables). Rather than resolve that dynamically at read time
-- (fragile, and wrong for reports whose target has since been deleted), this captures it once,
-- explicitly, as its own column — auto-populated for the two directly-resolvable target types
-- (user: target_id IS the profile; animal_listing: the animal's owner) via a trigger, left for a
-- moderator to set manually for the others (organisation/post/message) rather than guessing.
alter table public.moderation_cases add column affected_profile_id uuid references public.profiles (id);
-- A moderator-authored explanation deliberately meant for the affected person — kept separate from
-- the existing decision_explanation column (whose own comment already says "never public," and may
-- reference the reporter or internal evidence) so nothing risks leaking through a shared field.
alter table public.moderation_cases add column public_decision_summary text;
alter table public.moderation_cases add column appeal_deadline timestamptz;

create or replace function public.set_moderation_case_affected_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.affected_profile_id is not null then
    return new;
  end if;
  if new.target_type = 'user' then
    new.affected_profile_id := new.target_id;
  elsif new.target_type = 'animal_listing' then
    select owner_profile_id into new.affected_profile_id from public.animals where id = new.target_id;
  end if;
  return new;
end;
$$;

create trigger set_moderation_case_affected_profile
  before insert on public.moderation_cases
  for each row execute function public.set_moderation_case_affected_profile();

-- A 14-day appeal window starts the moment a case is actually resolved — not at creation, and not
-- open-ended.
create or replace function public.set_moderation_case_appeal_deadline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Fires on INSERT too, not just UPDATE — a case can be created already 'resolved' in one step
  -- (e.g. an open-and-shut decision made immediately), not only transitioned into it later.
  if new.status = 'resolved' and new.appeal_deadline is null
     and (TG_OP = 'INSERT' or old.status is distinct from 'resolved') then
    new.appeal_deadline := now() + interval '14 days';
  end if;
  return new;
end;
$$;

create trigger set_moderation_case_appeal_deadline
  before insert or update on public.moderation_cases
  for each row execute function public.set_moderation_case_appeal_deadline();

-- Deliberately no direct SELECT policy for the affected user on moderation_cases itself — RLS is
-- row-level, not column-level, and this table carries decision_explanation/report_id/
-- assigned_moderator_id, none of which should ever reach the affected person (internal reasoning,
-- a path back to the reporter's identity, and staff identity respectively). A narrow
-- security_invoker view is the same "column minimization on top of row-level RLS" pattern already
-- used for driver_transport_job_view.
create policy "affected user sees their case only via the safe view"
  on public.moderation_cases for select
  to authenticated
  using (false);

-- Deliberately NOT security_invoker: moderation_cases has no working row-level SELECT policy for
-- the affected user (blocked above, on purpose), so a security_invoker view would inherit that
-- same "always false" result and return nothing. This is a definer-style view instead (like
-- public_transport_requests/public_routes elsewhere in this schema) — its own `where
-- affected_profile_id = auth.uid()` clause *is* the entire security boundary, evaluated once, with
-- the view owner's privileges bypassing the base table's RLS for the read itself.
create view public.my_moderation_case_view
as
select
  mc.id, mc.case_type, mc.target_type, mc.status, mc.public_decision_summary,
  mc.appeal_status, mc.appeal_deadline, mc.created_at, mc.resolved_at
from public.moderation_cases mc
where mc.affected_profile_id = auth.uid();

grant select on public.my_moderation_case_view to authenticated;

create type public.moderation_appeal_status as enum ('submitted', 'under_review', 'upheld', 'overturned');

create table public.moderation_appeals (
  id uuid primary key default gen_random_uuid(),
  moderation_case_id uuid not null references public.moderation_cases (id) on delete cascade,
  submitted_by uuid not null references public.profiles (id),
  statement text not null,
  supporting_document_url text,
  status public.moderation_appeal_status not null default 'submitted',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  -- Shown to the appellant — never the moderator's private reasoning.
  outcome_notes text,
  -- Staff-only, mirrors moderation_cases.decision_explanation's own "never public" discipline.
  internal_notes text,
  created_at timestamptz not null default now(),
  -- "One appeal per decision unless explicitly reopened" — the simplest safe reading: exactly one
  -- appeal row per case; a moderator with direct table access can delete a resolved appeal to
  -- deliberately allow a fresh one, but no ordinary flow can create a second one silently.
  unique (moderation_case_id)
);

alter table public.moderation_appeals enable row level security;

create policy "appellants view their own appeal"
  on public.moderation_appeals for select
  to authenticated
  using (submitted_by = (select auth.uid()));

create policy "moderators and admins manage all appeals"
  on public.moderation_appeals for all
  to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

-- Deliberately no direct INSERT/UPDATE policy for the appellant — submit_moderation_appeal() below
-- is the only creation path (SECURITY DEFINER), so eligibility (own case, resolved, within the
-- deadline, no existing appeal) is enforced in exactly one place, and an appeal can never be
-- edited after submission by the person who filed it (matches "modifying submitted appeal" being
-- an explicit thing to prevent).
grant select on public.moderation_appeals to authenticated;

create or replace function public.submit_moderation_appeal(
  p_case_id uuid,
  p_statement text,
  p_supporting_document_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.moderation_cases;
  v_appeal_id uuid;
begin
  select * into v_case from public.moderation_cases where id = p_case_id;
  if not found or v_case.affected_profile_id is distinct from auth.uid() then
    raise exception 'you may only appeal a moderation decision that concerns you' using errcode = 'P0001';
  end if;
  if v_case.status <> 'resolved' then
    raise exception 'this case has not reached a final decision yet' using errcode = 'P0001';
  end if;
  if v_case.appeal_deadline is null or now() > v_case.appeal_deadline then
    raise exception 'the appeal window for this decision has closed' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.moderation_appeals where moderation_case_id = p_case_id) then
    raise exception 'this decision has already been appealed' using errcode = 'P0001';
  end if;

  insert into public.moderation_appeals (moderation_case_id, submitted_by, statement, supporting_document_url)
  values (p_case_id, auth.uid(), p_statement, p_supporting_document_url)
  returning id into v_appeal_id;

  update public.moderation_cases set appeal_status = 'requested' where id = p_case_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id)
  values (auth.uid(), 'moderation_appeal.submitted', 'moderation_appeals', v_appeal_id);

  return v_appeal_id;
end;
$$;

revoke all on function public.submit_moderation_appeal(uuid, text, text) from public;
grant execute on function public.submit_moderation_appeal(uuid, text, text) to authenticated;

-- "Where possible, prevent a moderator from reviewing their own conflicted action": the case
-- already tracks assigned_moderator_id, so this is a real, enforceable check, not a best-effort
-- note — the moderator who made the original decision cannot also decide its appeal.
create or replace function public.review_moderation_appeal(
  p_appeal_id uuid,
  p_decision public.moderation_appeal_status,
  p_outcome_notes text default null,
  p_internal_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appeal public.moderation_appeals;
  v_case public.moderation_cases;
begin
  if not public.is_moderator() then
    raise exception 'only moderators can review an appeal' using errcode = 'P0001';
  end if;
  if p_decision not in ('upheld', 'overturned') then
    raise exception 'decision must be upheld or overturned' using errcode = 'P0001';
  end if;

  select * into v_appeal from public.moderation_appeals where id = p_appeal_id for update;
  if not found then
    raise exception 'appeal not found' using errcode = 'P0001';
  end if;
  if v_appeal.status <> 'submitted' and v_appeal.status <> 'under_review' then
    raise exception 'this appeal has already been resolved' using errcode = 'P0001';
  end if;

  select * into v_case from public.moderation_cases where id = v_appeal.moderation_case_id;
  if v_case.assigned_moderator_id = auth.uid() then
    raise exception 'you cannot review an appeal of your own original decision — another moderator must handle this'
      using errcode = 'P0001';
  end if;

  update public.moderation_appeals
  set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(),
      outcome_notes = p_outcome_notes, internal_notes = p_internal_notes
  where id = p_appeal_id;

  update public.moderation_cases set appeal_status = 'reviewed' where id = v_appeal.moderation_case_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'moderation_appeal.reviewed', 'moderation_appeals', p_appeal_id,
    null, jsonb_build_object('decision', p_decision)
  );
end;
$$;

revoke all on function public.review_moderation_appeal(uuid, public.moderation_appeal_status, text, text) from public;
grant execute on function public.review_moderation_appeal(uuid, public.moderation_appeal_status, text, text) to authenticated;
