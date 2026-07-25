-- Stage CJR (third/fourth supplemental queue): notification deduplication.
-- create_notification_if_enabled() (Stage H) is the one real producer every notifyUser() call
-- routes through (confirmed by grep: exactly one `insert into public.notifications` anywhere in
-- this schema) -- but it had no deduplication concept at all. All 4 real call sites
-- (rehoming_approved/rejected, application_status_change, moderation_decision) are invoked
-- directly from a client action with zero idempotency guard on the underlying state change: e.g.
-- approveRehomingReview() (src/lib/queries/rehoming.ts) does a plain `.update()` with no
-- `admin_status = 'pending'` guard, so a double-click, a retried network call after a dropped
-- response, or two admins acting on the same review at once each independently succeed at the
-- update *and* each call notifyUser() again -- a real, reachable path to duplicate notifications
-- for the exact same event, not a hypothetical one.
--
-- A dedup key belongs at the notification-creation layer regardless of whether the upstream
-- action is itself idempotent -- producers can be invoked more than once for many reasons this
-- session doesn't control (retries, double-clicks, future concurrent callers), and this is the one
-- place every one of them already passes through.
alter table public.notifications add column dedup_key text;

-- Partial (not a plain unique constraint): most future call sites will still legitimately pass no
-- dedup_key at all (a NULL dedup_key means "no dedup requested, always create"), and NULL never
-- collides with NULL in a plain unique index anyway in Postgres -- but being explicit that only
-- *provided* keys are deduped, scoped per-recipient, keeps the intent unambiguous.
create unique index notifications_profile_dedup_key_idx
  on public.notifications (profile_id, dedup_key)
  where dedup_key is not null;

-- create or replace can't be used here: adding a new trailing parameter changes the function's
-- signature (6 args -> 7), which Postgres treats as a distinct overload rather than a replacement
-- -- the old 6-arg version would otherwise be left behind as a stale, ungoverned duplicate that
-- some future call could still resolve to. Drop it explicitly first.
drop function if exists public.create_notification_if_enabled(uuid, text, text, text, text, text);

create function public.create_notification_if_enabled(
  p_profile_id uuid,
  p_category text,
  p_notification_type text,
  p_title text,
  p_body text default null,
  p_link_url text default null,
  p_dedup_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification_id uuid;
begin
  if not public.get_notification_preference(p_profile_id, p_category) then
    return null;
  end if;

  -- Atomic insert-or-return-existing: the partial unique index above is the real guarantee (safe
  -- under concurrent callers racing the same dedup_key), this is just how a single statement
  -- expresses "create it, or tell me the id of the one that already exists" without a separate
  -- check-then-act race window. A NULL p_dedup_key never matches the partial index's predicate, so
  -- those inserts are never deduped -- unchanged behaviour for any future caller that opts out.
  insert into public.notifications (profile_id, notification_type, title, body, link_url, dedup_key)
  values (p_profile_id, p_notification_type, p_title, p_body, p_link_url, p_dedup_key)
  on conflict (profile_id, dedup_key) where dedup_key is not null do nothing
  returning id into v_notification_id;

  if v_notification_id is null and p_dedup_key is not null then
    select id into v_notification_id
    from public.notifications
    where profile_id = p_profile_id and dedup_key = p_dedup_key;
  end if;

  return v_notification_id;
end;
$$;

revoke all on function public.create_notification_if_enabled(uuid, text, text, text, text, text, text) from public;
grant execute on function public.create_notification_if_enabled(uuid, text, text, text, text, text, text) to authenticated;
