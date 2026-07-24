-- Stage AA (supplemental queue): disabled payment-provider abstraction. Audited fundraising (the
-- closest thing this schema has to a payment-adjacent feature, explicitly disabled behind
-- src/lib/fundraising-flag.ts pending a real provider) and found a real integrity gap:
-- "eligible org owners update their own non-terminal campaigns" (20260101005600_fundraising.sql)
-- lets an org set its own campaign's status to 'target_reached' or 'partially_funded' -- but per
-- docs/FUNDRAISING_POLICY.md ("Campaign states"), these are meant to be *outcomes* of real
-- fundraising activity ("active -> (target_reached | partially_funded | expired)"), not states an
-- organisation should be able to declare for itself. Both labels are shown publicly
-- (src/lib/queries/fundraising.ts's status labels, "Target reached" / "Deadline passed --
-- partially funded"), and nothing ties them to the campaign's real computed total
-- (public_fundraising_totals) -- an organisation could publicly claim "Target reached" on a
-- campaign that collected nothing. The policy comment's own stated reasoning already drew this
-- exact line for approved/suspended/refund_review/completed ("only an admin can set..."); these
-- two outcome states belong on the same side of that line, not the org-free side, matching the
-- policy document's "no state may be skipped in a way that lets money move" principle.
drop policy "eligible org owners update their own non-terminal campaigns" on public.fundraising_campaigns;

create policy "eligible org owners update their own non-terminal campaigns"
  on public.fundraising_campaigns for update
  to authenticated
  using (public.owns_org(organisation_id) and status not in ('completed', 'refund_review'))
  with check (
    public.owns_org(organisation_id)
    and public.is_eligible_fundraising_org(organisation_id)
    and public.fundraising_campaign_links_are_valid(
      organisation_id, animal_id, buyer_application_id, transport_request_id, quotation_id
    )
    -- An org may move their own campaign between draft/organisation_review/active/expired/
    -- transport_cancelled themselves. Everything else -- approved, target_reached,
    -- partially_funded, suspended, refund_review, completed -- is either a compliance decision or
    -- a factual outcome of real fundraising activity, and requires an admin.
    and status in ('draft', 'organisation_review', 'active', 'expired', 'transport_cancelled')
  );
