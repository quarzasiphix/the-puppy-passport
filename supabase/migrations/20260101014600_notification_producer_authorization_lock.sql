-- Independently verified from a Bot 1 audit finding (H-2/§5.3, isolated read-only clone
-- /p/the-puppy-passport-bot1-overnight-20260728-233809 — content used only as a lead, reproduced
-- live against this repo's own database before writing this fix).
--
-- create_notification_if_enabled() (Stage H, extended through Stages CJR/CJS) is the one real
-- producer every client notifyUser()/notifyUserFromTemplate() call routes through — but it never
-- checked whether the calling user had any real relationship to the target p_profile_id at all,
-- only whether the target's own preference for the category allowed it. Being SECURITY DEFINER, it
-- runs with the function owner's privileges and completely bypasses notifications' own RLS —
-- including its two already-correctly-scoped raw-INSERT policies ("moderators and admins create
-- notifications for any user", "org owners notify applicants to their organisation"). Confirmed
-- empirically: EXECUTE is granted to `authenticated`, so any logged-in user could call this RPC
-- directly with an arbitrary p_profile_id, title, body, and link_url — a zero-privilege arbitrary-
-- recipient, arbitrary-content phishing primitive.
--
-- Fixed by having the function enforce the exact same boundary its own table's RLS policies
-- already establish for legitimate raw inserts (confirmed by reading their live with_check clauses
-- first, not assumed) — self-notification, is_moderator() (covers admin, per is_moderator()'s own
-- definition), or an org owner notifying a real applicant to their own organisation. Checked every
-- real call site in src/ before writing this (4 total: 2 moderation-decision notifications, 2
-- admin-only rehoming-review notifications, 1 org-owner-notifies-applicant) — all covered by this
-- exact check, so no legitimate flow is affected.
create or replace function public.create_notification_if_enabled(
  p_profile_id uuid,
  p_category text,
  p_notification_type text,
  p_title text,
  p_body text default null,
  p_link_url text default null,
  p_dedup_key text default null,
  p_template_version integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification_id uuid;
begin
  if not (
    auth.uid() = p_profile_id
    or public.is_moderator()
    or exists (
      select 1 from public.buyer_applications ba
      where ba.buyer_id = p_profile_id
        and ba.organization_id is not null
        and public.owns_org(ba.organization_id)
    )
  ) then
    raise exception 'you are not authorised to notify this user' using errcode = 'P0001';
  end if;

  if not public.get_notification_preference(p_profile_id, p_category) then
    return null;
  end if;

  insert into public.notifications
    (profile_id, notification_type, title, body, link_url, dedup_key, template_version)
  values
    (p_profile_id, p_notification_type, p_title, p_body, p_link_url, p_dedup_key, p_template_version)
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
