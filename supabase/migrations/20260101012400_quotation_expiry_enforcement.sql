-- Stage IR-9 (integration-readiness queue): document expiry jobs. Auditing every expiry_date-
-- bearing column across the schema found transport_documents/vehicles.insurance_expiry_date/
-- drivers already have a real, deliberate, already-wired client-computed expiry warning
-- (documentExpiryWarning() in transport.ts, expiryWarnings() in fleet.ts -- the same "no
-- background job exists, so compute staleness on read" pattern this session has confirmed
-- elsewhere, e.g. Stage BA's own finding that no scheduler exists). quotations.expiry_date was the
-- one genuine gap: "requesters accept or reject their own quotation" (20260101001500_quotations.sql)
-- only ever checked the target status was accepted/rejected -- nothing stopped a customer accepting
-- a quotation whose expiry_date had already passed, server-side or in the UI (which only ever
-- displayed the raw date as plain text, "Valid until ...", with no warning once it was in the
-- past). A customer accepting a stale price commitment is a real business-logic problem, not merely
-- advisory (unlike Stage IR-8's scheduling conflicts, which are a deliberately different, hard-
-- learned distinction this session just re-confirmed) -- there is no existing design intent that
-- says "let customers accept expired quotes," so this is closed as a genuine fix, not reverted.
--
-- Rejecting an expired quotation is still allowed (declining a stale offer is always harmless);
-- only the transition *to* accepted is blocked once expiry_date has passed. A null expiry_date
-- (no expiry ever set) is unaffected.
drop policy "requesters accept or reject their own quotation" on public.quotations;

create policy "requesters accept or reject their own quotation"
  on public.quotations for update
  to authenticated
  using (
    exists (
      select 1 from public.transport_requests tr
      where tr.id = transport_request_id and tr.requester_profile_id = (select auth.uid())
    )
  )
  with check (
    status in ('accepted', 'rejected')
    and (status <> 'accepted' or expiry_date is null or expiry_date >= current_date)
  );
