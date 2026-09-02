-- Stage FA-3 (fundraising publication control). Found a real, previously-undiscovered self-
-- publication bypass: "eligible org owners update their own non-terminal campaigns"
-- (20260101009100_fundraising_outcome_status_lock.sql) allows an org to self-set its own
-- campaign's status to 'active' -- and 'active' is exactly the status that makes a campaign
-- publicly visible ("public reads active/successful campaigns of public, approved organisations",
-- 20260101005600_fundraising.sql). There was never any requirement that the campaign pass through
-- 'approved' (an admin-only status under that same policy's own WITH CHECK) first -- an eligible
-- organisation can go straight from creating a draft to a fully public, donation-soliciting
-- campaign with zero admin review ever happening, contradicting this schema's own stated
-- principle for this feature ("no state may be skipped in a way that lets money move",
-- docs/FUNDRAISING_POLICY.md). Confirmed genuinely reachable, not hypothetical: the existing
-- fixture setup in tests/db/fundraising.test.ts's own "org cannot self-declare target_reached"
-- test does exactly this (insert as draft, self-update straight to 'active') without ever
-- questioning it, since that test's own focus was a different, later transition.
--
-- Fixed the same way this schema handles every other "specific transition, not just specific
-- values" restriction (prevent_non_staff_operational_field_changes(),
-- prevent_fundraising_purpose_change_after_payment()) -- a BEFORE UPDATE trigger, since a bare RLS
-- policy's WITH CHECK can only see the new row, not compare it against the old one. Admins remain
-- completely unconstrained (they're the trusted actor this whole gate exists to require); an
-- eligible org can still freely move between every RLS-permitted value except this one specific
-- transition, which now requires the campaign to already be 'approved'.
create or replace function public.prevent_fundraising_self_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.status is distinct from old.status
     and new.status = 'active'
     and old.status <> 'approved'
  then
    raise exception 'A fundraising campaign can only go live after Anemalo staff have approved it.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger fundraising_campaigns_prevent_self_publish
  before update on public.fundraising_campaigns
  for each row execute function public.prevent_fundraising_self_publish();
