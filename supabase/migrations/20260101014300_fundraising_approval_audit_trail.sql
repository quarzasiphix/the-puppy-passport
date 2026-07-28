-- Self-directed follow-up to Stage FA-3 (docs/FUNDRAISING_PUBLICATION_CONTROL_AUDIT.md), which
-- flagged this exact gap and deliberately deferred it to keep that stage's own change minimal:
-- "Authorised administrative publication is audited" -- checked at FA-3 and found untrue. No
-- audit_logs entry is written when an admin approves a fundraising campaign
-- ("admins manage all fundraising campaigns" is a plain RLS `for all` policy, not an RPC, so there
-- was never anywhere for an audit insert to live). Every other comparably consequential admin
-- action in this schema already writes one (Stage YR-7's admin-command-audit-coverage pass,
-- place_legal_hold/release_legal_hold's own XR-16 fix, etc.) -- fundraising campaign approval was
-- the one exception.
--
-- No new RPC is introduced (the raw-RLS-update path is deliberately preserved, matching this
-- table's existing admin-trusted-actor design established at FA-3's own self-publish-lock trigger)
-- -- an AFTER UPDATE trigger, firing only on the specific approved transition, is the minimal fix
-- that covers the raw-update path directly rather than requiring admins to start going through a
-- new mediating function.
create or replace function public.audit_fundraising_campaign_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
    values (
      auth.uid(), 'fundraising_campaign.approved', 'fundraising_campaigns', new.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status)
    );
  end if;

  return new;
end;
$$;

create trigger fundraising_campaigns_audit_approval
  after update on public.fundraising_campaigns
  for each row execute function public.audit_fundraising_campaign_approval();
