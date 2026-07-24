-- Stage BU (supplemental queue): archival. `rate_limit_events` (Stage J) has grown unbounded since
-- day one -- every accepted rate-limited action inserts a permanent row and nothing ever removes
-- one. The original migration's own comment already named the intended fix ("Old rows are pure
-- noise once their own window has passed... cheap enough to prune opportunistically rather than
-- needing a scheduled job") and even added `rate_limit_events_created_at_idx` to support it, but
-- the actual pruning code was never written -- the same "schema/index designed for X, X never
-- wired up" shape as `messages.attachment_url`/`transport_status_history.evidence_url` before they
-- were closed earlier this session. Concretely demonstrated by this very session's own test run
-- history: many dozens of non-reset `test:db` runs have left thousands of rows with zero remaining
-- purpose (every one is outside every action's window by now).
--
-- No background job/scheduler exists in this codebase (Stage BA audited this and found no other
-- reachable need for one) -- rather than introducing one just for this, the fix stays exactly what
-- the original comment proposed: enforce_rate_limit() already reads this exact (actor, action_key,
-- window) slice on every single call it makes; deleting this same actor's own stale rows for this
-- same action first is a natural, free byproduct of a call that already has to happen, not a new
-- code path. This can never remove a row still inside its own window (the same `now() - p_window`
-- boundary the count check itself uses), so a caller's own current standing is never affected.
create or replace function public.enforce_rate_limit(
  p_action_key text,
  p_max_count integer,
  p_window interval
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_count integer;
begin
  if v_actor is null then
    return;
  end if;

  delete from public.rate_limit_events
  where actor_profile_id = v_actor
    and action_key = p_action_key
    and created_at <= now() - p_window;

  select count(*) into v_count
  from public.rate_limit_events
  where actor_profile_id = v_actor
    and action_key = p_action_key;

  if v_count >= p_max_count then
    raise exception 'You''ve done this too many times recently — please wait a bit before trying again.'
      using errcode = 'P0001';
  end if;

  insert into public.rate_limit_events (actor_profile_id, action_key) values (v_actor, p_action_key);
end;
$$;
