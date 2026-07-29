-- Independently verified from a Bot 1 audit finding (H-5/NEW-H3, reproduced live against this
-- repo's own database before fixing, not trusted from the report alone).
--
-- "owners manage their kennel's achievements" (ALL, `owns_org(kennel_id)`) has no restriction on
-- verification_status/admin_notes/reviewed_at -- an organisation owner could raw-update their own
-- achievement straight to verification_status = 'approved' (the exact status that makes it public,
-- per "public reads verified achievements of public approved kennels"), forge reviewed_at, and even
-- write their own admin_notes. Confirmed empirically: this succeeds today with no error at all.
--
-- The org owner's only real, currently-built write surface is INSERT (creating a new achievement,
-- always starting 'pending' by default) -- no client update path exists yet. Fixed the same way
-- this schema handles every other "shared row, owner may edit content but not the review outcome"
-- case (buyer_applications' write-lock trigger): a trigger blocking non-admin changes to
-- verification_status/admin_notes/reviewed_at specifically, leaving ordinary content fields
-- (title, issuing_body, achieved_on, evidence_url) freely owner-editable for a future correction
-- flow, rather than removing UPDATE from the owner's policy entirely.
create or replace function public.prevent_achievement_self_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.verification_status is distinct from old.verification_status
    or new.admin_notes is distinct from old.admin_notes
    or new.reviewed_at is distinct from old.reviewed_at
  then
    raise exception 'Only an admin can verify or review an achievement.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger prevent_achievement_self_verification
  before update on public.achievements
  for each row execute function public.prevent_achievement_self_verification();
