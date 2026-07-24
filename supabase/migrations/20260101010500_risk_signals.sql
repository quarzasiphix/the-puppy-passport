-- Stage BN (supplemental queue): explainable risk signals. Rule-based only -- no opaque score,
-- no ML, every signal traces to one real, already-existing event source with an explicit rule
-- version. Deliberately wired to exactly one concrete, already-real event to start: a
-- rate-limit rejection (enforce_rate_limit(), Stage J) is the clearest "repeated X" abuse
-- signal this schema already produces, and the mechanism generalises the same way to the other
-- examples in this stage's brief (repeated report submissions, repeated document rejections,
-- etc.) once there's a concrete need -- not wired everywhere speculatively here.
create type public.risk_signal_type as enum (
  'repeated_rate_limit_hits',
  'repeated_moderation_submission_failures',
  'repeated_duplicate_applications',
  'repeated_document_rejections',
  'multiple_independent_reports',
  'repeated_idempotency_conflicts',
  'invitation_burst',
  'repeated_ownership_transfer_failures'
);

create table public.risk_signals (
  id uuid primary key default gen_random_uuid(),
  signal_type public.risk_signal_type not null,
  subject_profile_id uuid not null references public.profiles (id) on delete cascade,
  source_event_type text not null,
  rule_version text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrence_count integer not null default 1,
  explanation text not null,
  reviewed boolean not null default false,
  is_false_positive boolean,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  resolution_notes text,
  -- One row per (subject, signal_type) -- repeated real events increment occurrence_count rather
  -- than creating duplicate rows, matching "duplicate event increments instead of duplicating".
  unique (subject_profile_id, signal_type)
);

alter table public.risk_signals enable row level security;

-- No INSERT/UPDATE policy for ordinary authenticated users at all, by design -- every signal is
-- produced by record_risk_signal() below (SECURITY DEFINER, called from trusted trigger/RPC
-- context, never directly grantable to a client), matching "prevent client-side signal creation".
-- Staff read/review through explicit RPCs, not a raw table grant, so exactly which fields can
-- change stays controlled in one place.
create policy "ops staff view risk signals"
  on public.risk_signals for select
  to authenticated
  using (public.is_ops_staff());

-- Same auto_expose_new_tables=false gotcha this session has now hit five times: RLS alone doesn't
-- make a table reachable via the Data API, a table-level GRANT is also required per operation.
-- Deliberately SELECT only here -- no insert/update/delete grant at all, so even is_ops_staff()
-- could never open a client-side write path against this table by accident in the future; the two
-- RPCs above are the only way rows are ever created or changed.
grant select on public.risk_signals to authenticated;

-- record_risk_signal(): the one real write path. Upserts by (subject, signal_type) -- a repeat of
-- the same signal for the same person increments occurrence_count and bumps last_seen_at instead
-- of creating a new row. SECURITY DEFINER and never granted to `authenticated` directly (see the
-- revoke below) -- only callable from other SECURITY DEFINER functions that already run with
-- elevated privilege, keeping this fully server-controlled.
create or replace function public.record_risk_signal(
  p_signal_type public.risk_signal_type,
  p_subject_profile_id uuid,
  p_source_event_type text,
  p_rule_version text,
  p_explanation text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.risk_signals (
    signal_type, subject_profile_id, source_event_type, rule_version, explanation
  ) values (
    p_signal_type, p_subject_profile_id, p_source_event_type, p_rule_version, p_explanation
  )
  on conflict (subject_profile_id, signal_type) do update
  set occurrence_count = risk_signals.occurrence_count + 1,
      last_seen_at = now(),
      -- A resolved false positive that recurs is worth surfacing again, not staying silently
      -- marked resolved forever -- but a genuine repeat doesn't erase the review history, only
      -- reopens visibility.
      reviewed = case when risk_signals.is_false_positive then false else risk_signals.reviewed end;
end;
$$;

revoke all on function public.record_risk_signal(public.risk_signal_type, uuid, text, text, text) from public;
revoke all on function public.record_risk_signal(public.risk_signal_type, uuid, text, text, text) from authenticated;

-- mark_risk_signal_reviewed(): the one real update path for staff -- reviewed status, false-
-- positive flag and resolution notes, nothing else. A signal alone never suspends or rejects an
-- account (matching "do not automatically punish a user solely because a signal exists") -- this
-- table is advisory input for a human decision elsewhere (moderation, verification review), never
-- a trigger for automatic action.
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
end;
$$;

revoke all on function public.mark_risk_signal_reviewed(uuid, boolean, text) from public;
grant execute on function public.mark_risk_signal_reviewed(uuid, boolean, text) to authenticated;

-- The one real wiring for this stage: rate_limit_events (Stage J). enforce_rate_limit() itself is
-- deliberately left untouched below (byte-identical to 20260101008200) -- a first version of this
-- migration tried recording a risk signal on the rejected call, inside the same function, right
-- before the `raise exception`. That never actually works: PostgREST runs each RPC call as one
-- transaction, and an uncaught `raise exception` aborts and rolls back that entire transaction --
-- including any insert that ran earlier in the same call, discovered by actually hitting the limit
-- in a real test and finding rate_limit_events never grew past what earlier *successful* calls had
-- already committed. Durably recording something at the exact moment of rejection would need an
-- autonomous/out-of-band transaction (e.g. dblink to a second connection), which is a much bigger
-- piece of infrastructure than this stage's scope justifies.
--
-- Instead: every accepted (non-rejected) call already inserts a real, durably committed
-- rate_limit_events row -- so an AFTER INSERT trigger on that table, firing once a given actor
-- crosses a meaningful fraction of that specific action's real configured ceiling (see the
-- max_count values at each perform enforce_rate_limit(...) call site in 20260101008200 and
-- 20260101008300), is the one genuinely real, committed, explainable event source available here.
create or replace function public.check_rate_limit_event_for_risk_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window interval;
  v_threshold integer;
  v_count integer;
begin
  -- Matches each real perform enforce_rate_limit(action_key, max_count, window) call site;
  -- threshold is roughly 75% of that action's actual max_count -- "clearly a heavy, repeated
  -- pattern" without being so tight that ordinary bursts of legitimate use trip it. An
  -- action_key with no case here has no threshold configured yet and is silently skipped, not
  -- treated as suspicious by default.
  case new.action_key
    when 'transport_draft_creation' then v_window := interval '1 hour'; v_threshold := 75;
    when 'transport_amendment_request' then v_window := interval '1 hour'; v_threshold := 15;
    when 'org_invitation' then v_window := interval '1 hour'; v_threshold := 75;
    when 'report_submission' then v_window := interval '1 hour'; v_threshold := 22;
    when 'message_send' then v_window := interval '1 minute'; v_threshold := 22;
    when 'welfare_case_submission' then v_window := interval '1 day'; v_threshold := 37;
    when 'application_submission' then v_window := interval '1 hour'; v_threshold := 45;
    else return new;
  end case;

  select count(*) into v_count
  from public.rate_limit_events
  where actor_profile_id = new.actor_profile_id
    and action_key = new.action_key
    and created_at > now() - v_window;

  -- Fires once per rolling-window crossing, not on every subsequent call past the threshold --
  -- record_risk_signal() still increments occurrence_count each time this actor crosses the
  -- threshold again in a later window, which is the real "repeated over time" signal.
  if v_count = v_threshold then
    perform public.record_risk_signal(
      'repeated_rate_limit_hits',
      new.actor_profile_id,
      new.action_key,
      'v1',
      format(
        'Reached %s uses of the rate-limited action "%s" within a %s window -- a heavy, repeated usage pattern worth a human look, not by itself proof of abuse.',
        v_count, new.action_key, v_window
      )
    );
  end if;

  return new;
end;
$$;

create trigger rate_limit_event_risk_signal
  after insert on public.rate_limit_events
  for each row execute function public.check_rate_limit_event_for_risk_signal();
