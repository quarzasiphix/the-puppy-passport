-- Stage J: abuse prevention. docs/FINALISATION_REPORT.md already documented the gap plainly:
-- "nothing throttles repeated auth attempts, application/message spam, or API abuse... correctly
-- an infra-level concern (Cloudflare WAF / Supabase Auth rate limits, both configured outside this
-- repo) rather than a code fix, but it doesn't exist yet anywhere." Auth-attempt throttling really
-- is infra-only (Supabase Auth's own rate limits, not something this repo can implement) — but
-- several of the abuse vectors this phase lists (report spam, message spam, welfare-case spam,
-- application spam, invitation spam, amendment spam, transport-draft spam) are ordinary
-- authenticated-user actions this database fully controls, and had zero protection of any kind
-- until now. This is a real, code-enforced, per-actor cooldown -- not a claim that Cloudflare/
-- Supabase-level limits are active (they are not, and remain genuinely external configuration; see
-- docs/RATE_LIMITING_AND_ABUSE_PROTECTION.md for exactly what still needs to happen outside this
-- repo).
--
-- Deliberately NOT an in-memory counter (that would reset on every server restart/cold start and
-- wouldn't work at all across the multiple Cloudflare Worker instances this app actually runs on)
-- -- a real table is the only correctness-preserving option available without external
-- infrastructure, matching "do not pretend an in-memory JavaScript map is distributed rate
-- limiting."
create table public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.profiles (id) on delete cascade,
  action_key text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_events_actor_action_idx
  on public.rate_limit_events (actor_profile_id, action_key, created_at);

-- Old rows are pure noise once their own window has passed for every action_key that will ever
-- exist (all currently well under 24h) — cheap enough to prune opportunistically rather than
-- needing a scheduled job for what is, worst case, a small append-only table.
create index rate_limit_events_created_at_idx on public.rate_limit_events (created_at);

alter table public.rate_limit_events enable row level security;
-- No policy at all for ordinary authenticated users, by design — every access goes through
-- enforce_rate_limit() (SECURITY DEFINER) below, never a direct table read/write from the client.
create policy "admins can inspect rate limit events"
  on public.rate_limit_events for select
  to authenticated
  using (public.is_admin());

-- Same auto_expose_new_tables=false gotcha documented in 20260101002900_table_grants.sql and
-- re-found in 20260101006800_transport_request_animals_grants.sql: RLS policies alone don't make a
-- table reachable via the Data API, a table-level GRANT is also required — confirmed by actually
-- calling this from a real client and hitting "permission denied for table rate_limit_events"
-- despite the SELECT policy above being correct. RLS (admin-only rows) still fully governs what a
-- non-admin actually sees; this grant only makes the table reachable at all.
grant select on public.rate_limit_events to authenticated;

-- The one real evaluation point every abuse-prone insert/RPC below routes through. Raises with a
-- plain-language, non-alarming message (never "429" or an internal code) if the actor has already
-- performed this action p_max_count times within p_window; otherwise records this attempt and
-- returns silently. A null auth.uid() (migrations/seed/service context) is never rate-limited.
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

  select count(*) into v_count
  from public.rate_limit_events
  where actor_profile_id = v_actor
    and action_key = p_action_key
    and created_at > now() - p_window;

  if v_count >= p_max_count then
    raise exception 'You''ve done this too many times recently — please wait a bit before trying again.'
      using errcode = 'P0001';
  end if;

  insert into public.rate_limit_events (actor_profile_id, action_key) values (v_actor, p_action_key);
end;
$$;

revoke all on function public.enforce_rate_limit(text, integer, interval) from public;
grant execute on function public.enforce_rate_limit(text, integer, interval) to authenticated;

-- Report spam: "authenticated users can file a report" had no limit at all — any signed-in user
-- could flood the moderation queue with unlimited reports against any target.
create or replace function public.rate_limit_report_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_rate_limit('report_submission', 30, interval '1 hour');
  return new;
end;
$$;

create trigger rate_limit_report_submission
  before insert on public.reports
  for each row execute function public.rate_limit_report_submission();

-- Message spam: "participants send messages" (messaging.sql) had no limit either. A generous
-- threshold — legitimate conversation, including a busy support/ops exchange, stays well under it.
create or replace function public.rate_limit_message_send()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_rate_limit('message_send', 30, interval '1 minute');
  return new;
end;
$$;

create trigger rate_limit_message_send
  before insert on public.messages
  for each row execute function public.rate_limit_message_send();

-- Welfare-case spam: unlimited submissions could flood operations with fake urgent cases.
create or replace function public.rate_limit_welfare_case_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_rate_limit('welfare_case_submission', 50, interval '1 day');
  return new;
end;
$$;

create trigger rate_limit_welfare_case_submission
  before insert on public.welfare_cases
  for each row execute function public.rate_limit_welfare_case_submission();

-- Application/adoption-enquiry spam: buyer_applications already has "one active application per
-- buyer/animal" (a real, different protection — prevents duplicate applications for the *same*
-- animal), but nothing stopped rapidly applying to many *different* animals/organisations.
create or replace function public.rate_limit_application_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_rate_limit('application_submission', 60, interval '1 hour');
  return new;
end;
$$;

create trigger rate_limit_application_submission
  before insert on public.buyer_applications
  for each row execute function public.rate_limit_application_submission();
