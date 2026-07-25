-- Stage CJS (third/fourth supplemental queue): notification template versioning. Complements CJR's
-- dedup key -- together they guarantee a retried/replayed event never silently changes a
-- notification's wording: the rendered text is computed once (by a pure, versioned render function
-- in src/lib/notification-templates.ts) and persisted permanently at creation, and a retry with the
-- same dedup_key returns the original row untouched rather than re-rendering or overwriting it.
-- template_version is an audit trail of which version of the render logic produced the stored
-- text, not something ever re-resolved at read time -- so an "unsupported version" can never
-- surface as a rendering failure to a reader, only as a discoverable fact for whoever's debugging
-- why an old notification reads differently from what the current template would produce today.
alter table public.notifications add column template_version integer;

alter table public.notifications
  add constraint notifications_template_version_positive
  check (template_version is null or template_version >= 1);

drop function if exists public.create_notification_if_enabled(uuid, text, text, text, text, text, text);

create function public.create_notification_if_enabled(
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

revoke all on function public.create_notification_if_enabled(uuid, text, text, text, text, text, text, integer) from public;
grant execute on function public.create_notification_if_enabled(uuid, text, text, text, text, text, text, integer) to authenticated;
