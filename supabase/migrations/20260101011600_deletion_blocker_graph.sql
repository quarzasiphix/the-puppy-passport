-- Stage CJI (third/fourth supplemental queue): deletion-blocker graph. `execute_account_deletion()`
-- (Stage AI, extended in CJH) already checks every real blocker condition, but only ever reports
-- the *first* one it finds (an `elsif` chain) -- an admin working through a pending deletion
-- request currently discovers blockers one at a time, by repeatedly attempting and re-reading the
-- error after fixing each one. `dashboard.admin.users.tsx`'s own copy already explains in prose
-- what *can* block a deletion, but never what *actually does*, for a specific pending request,
-- before the admin tries.
--
-- get_account_deletion_blockers() reuses the exact same conditions execute_account_deletion()
-- already checks (transport request, reservation, application, org ownership, legal hold) but
-- returns every one that currently applies, not just the first -- read-only, admin-only, safe to
-- call before attempting the real deletion.
create or replace function public.get_account_deletion_blockers(p_profile_id uuid)
returns table (blocker text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can inspect account deletion blockers.'
      using errcode = 'P0001';
  end if;

  return query
  select 'an active transport request'
  where exists (
    select 1 from public.transport_requests
    where requester_profile_id = p_profile_id
      and status not in ('completed', 'rejected', 'cancelled_by_customer', 'cancelled_by_operations')
  )
  union all
  select 'an active reservation'
  where exists (
    select 1 from public.reservations
    where buyer_id = p_profile_id and status not in ('cancelled', 'completed')
  )
  union all
  select 'an active application'
  where exists (
    select 1 from public.buyer_applications
    where buyer_id = p_profile_id
      and status not in ('withdrawn', 'rejected', 'converted_to_reservation', 'expired')
  )
  union all
  select 'organisation ownership that has not been transferred'
  where exists (select 1 from public.organisations where owner_user_id = p_profile_id)
  union all
  select 'an active legal hold'
  where exists (
    select 1 from public.legal_holds where subject_profile_id = p_profile_id and released_at is null
  );
end;
$$;

revoke all on function public.get_account_deletion_blockers(uuid) from public;
grant execute on function public.get_account_deletion_blockers(uuid) to authenticated;
