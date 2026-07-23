-- Stage H: notification preferences. Both dashboard.breeder.settings.tsx and
-- dashboard.foundation.settings.tsx already show an honest "Per-notification preferences coming
-- soon" placeholder ("You currently receive all account notifications") — this replaces it with a
-- real, working preference system.
--
-- Scope is deliberately grounded in what's real: `grep -rn "notifyUser({" -A3 src/` finds exactly
-- four notification_type values ever actually created anywhere in the app —
-- application_status_change, moderation_decision, rehoming_approved, rehoming_rejected. This
-- migration adds categories for all of them (applications, adoption, moderation) plus a mandatory
-- 'security' category reserved for future account/security-critical notices — "channels may only
-- be shown as available where they actually exist" applies equally to *categories*: it would be
-- dishonest to ship a settings page with toggles for "transport updates" or "quotations" that no
-- code path ever actually sends. Adding a new category later (once a real notifyUser() call site
-- for it exists) is a one-line addition to the check constraint below, not a redesign.
--
-- Only one channel exists in this app at all: in-app (no email/push delivery integration exists
-- anywhere in the codebase, confirmed the same way) — so there is nothing to "distinguish creating
-- the in-app record from sending an optional email" here; disabling a category simply means the
-- in-app record itself is skipped, since in-app is the only real channel.
create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('applications', 'adoption', 'moderation', 'security')),
  in_app_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, category)
);

create trigger set_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;

create policy "users manage their own notification preferences"
  on public.notification_preferences for all
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

grant select, insert, update, delete on public.notification_preferences to authenticated;

-- Opt-out, not opt-in: no row for a (profile, category) pair means "enabled" (the same "you
-- currently receive all account notifications" default the placeholder already promised) —
-- someone who has never touched their settings must not go silent. 'security' always returns true
-- regardless of any stored row — "security-critical notifications must remain mandatory where
-- disabling them would create material risk."
create or replace function public.get_notification_preference(p_profile_id uuid, p_category text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_enabled boolean;
begin
  if p_category = 'security' then
    return true;
  end if;

  select in_app_enabled into v_enabled
  from public.notification_preferences
  where profile_id = p_profile_id and category = p_category;

  return coalesce(v_enabled, true);
end;
$$;

revoke all on function public.get_notification_preference(uuid, text) from public;
grant execute on function public.get_notification_preference(uuid, text) to authenticated;

-- Preference-aware notification creation — the one real evaluation point every notifyUser() call
-- site should route through, so the check lives in exactly one place rather than being repeated
-- (and potentially forgotten) at every call site. SECURITY DEFINER because the caller is very often
-- not the recipient (e.g. an org staffer notifying a buyer of a decision) and has no RLS insert
-- right on someone else's notifications row otherwise.
create or replace function public.create_notification_if_enabled(
  p_profile_id uuid,
  p_category text,
  p_notification_type text,
  p_title text,
  p_body text default null,
  p_link_url text default null
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

  insert into public.notifications (profile_id, notification_type, title, body, link_url)
  values (p_profile_id, p_notification_type, p_title, p_body, p_link_url)
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke all on function public.create_notification_if_enabled(uuid, text, text, text, text, text) from public;
grant execute on function public.create_notification_if_enabled(uuid, text, text, text, text, text) to authenticated;
