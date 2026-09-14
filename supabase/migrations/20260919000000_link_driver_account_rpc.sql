-- Closes the loop on drivers.login_email (20260918000000_driver_login_email_link.sql): linking a
-- driver record to a real Anemalo account is a sensitive, account-access-granting action, so it
-- needs an audit trail and a notification to the newly-linked person — neither of which a plain
-- client-side `.update()` can do, since audit_logs INSERT is restricted to is_ops_staff() only
-- (20260101009300_audit_logs_actor_lock_and_route_assignment_rpc.sql), which would silently block
-- a transport-company caller from ever recording the audit row.
--
-- Notifying the newly-linked profile can't go through create_notification_if_enabled() either —
-- that RPC's own caller-authorization lock (20260101014600) only allows a caller to notify
-- themselves, a moderator, or a buyer-application's org owner; an ops/company caller linking some
-- OTHER person's driver record matches none of those. Since 'security'-category notifications are
-- unconditionally delivered anyway (get_notification_preference() returns true for 'security'
-- before ever consulting a preference row), this function inserts directly into `notifications`
-- for that one delivery, which is exactly what create_notification_if_enabled() would have done.
create or replace function public.link_driver_account(
  p_driver_id uuid,
  p_login_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_old_profile_id uuid;
  v_new_profile_id uuid;
  v_clean_email text;
begin
  select organization_id, profile_id into v_org_id, v_old_profile_id
  from public.drivers
  where id = p_driver_id;

  if not found then
    raise exception 'driver not found' using errcode = 'P0001';
  end if;

  -- Exactly the same condition as the "ops staff manage drivers" / "company members manage their
  -- own drivers" RLS policies (routes_and_fleet.sql / fleet_multi_tenancy.sql) — this function can
  -- never do more than a direct .update() already allowed.
  if not (
    public.is_ops_staff()
    or (v_org_id is not null and public.is_org_member(v_org_id))
  ) then
    raise exception 'you do not have permission to manage this driver' using errcode = 'P0001';
  end if;

  v_clean_email := nullif(btrim(p_login_email), '');

  if v_clean_email is null then
    v_new_profile_id := null;
  else
    select id into v_new_profile_id
    from public.profiles
    where lower(email) = lower(v_clean_email);
  end if;

  update public.drivers
  set login_email = v_clean_email,
      profile_id = v_new_profile_id
  where id = p_driver_id;

  -- Only record/notify when the *link itself* actually changed — a routine save that doesn't
  -- touch the email (or re-saves the same one) shouldn't spam the audit log.
  if v_new_profile_id is distinct from v_old_profile_id then
    insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
    values (
      auth.uid(),
      case
        when v_old_profile_id is null and v_new_profile_id is not null then 'driver.account_linked'
        when v_old_profile_id is not null and v_new_profile_id is null then 'driver.account_unlinked'
        else 'driver.account_relinked'
      end,
      'drivers', p_driver_id,
      jsonb_build_object('profile_id', v_old_profile_id),
      jsonb_build_object('profile_id', v_new_profile_id)
    );

    if v_old_profile_id is null and v_new_profile_id is not null then
      insert into public.notifications (profile_id, notification_type, title, body, link_url)
      values (
        v_new_profile_id,
        'driver_account_linked',
        'You''ve been added as a driver',
        'You can now see your assigned jobs and update their status.',
        '/dashboard/driver'
      );
    end if;
  end if;
end;
$$;

revoke all on function public.link_driver_account(uuid, text) from public;
grant execute on function public.link_driver_account(uuid, text) to authenticated;
