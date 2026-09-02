# Support runbook

**Read this first**: `support_cases`/`support_case_messages` are real and tested at the database
layer, but there is currently no frontend anywhere in this app for a customer to open one, or for
staff to work one, through the UI. This runbook describes the real backend semantics (accurate and
enforced today) and the practical out-of-band process a pilot needs until that frontend exists —
it does not claim in-app support works, because it doesn't yet.

## What's actually real today

- `support_cases` table: creator, related resource, status, assigned staff, internal-vs-customer
  message distinction (`support_case_messages.is_internal` — mirrors the same internal-flag lock
  pattern already proven for transport/messaging).
- `claim_support_case()`: atomic, server-actor-stamped claim RPC (same pattern as
  `claim_moderation_case()`).
- Rate limits on case creation and message sending (`rate_limit_support_case_creation`/
  `rate_limit_support_case_message_send`).
- A protected-field trigger (`prevent_requester_writes_to_staff_controlled_support_fields`) —
  a requester cannot forge their own case's assignment or status.

All of the above is directly testable today via the raw Data API/RPCs (and is — see
`tests/db/support-cases.test.ts`, `support-case-rate-limits.test.ts`). What's missing is only the
UI: a "Contact support" form for customers, and a queue/case view for staff.

## The real process for this beta, until that UI exists

1. **Intake**: a pilot participant emails or otherwise directly contacts a real Anemalo
   staff member (define the actual channel before any pilot goes live — not specified here, since
   it's an operational decision, not a code fact).
2. **Triage taxonomy** (apply manually, matches the categories a future UI would offer):
   - Account access issue
   - Application dispute
   - Organisation complaint
   - Transport complaint
   - Suspected phishing (see `docs/ACCOUNT_SECURITY_RUNBOOK.md`)
   - Billing question — **there is no billing yet**; redirect to "not available in this beta,"
     never a real billing answer.
3. **Resolution record**: until a UI exists, staff can still create a real `support_cases` row
   directly (e.g. via Supabase Studio, as an admin) to keep a real, queryable record — better than
   an email thread with no system-of-record, and it exercises the same real RLS/audit path a future
   UI would use.
4. **Escalation**: account-security concerns → `docs/ACCOUNT_SECURITY_RUNBOOK.md`; moderation
   concerns → `docs/MODERATION_RUNBOOK.md`; transport concerns →
   `docs/TRANSPORT_INCIDENT_RUNBOOK.md`. Support is the front door; these are where the real
   authority to act lives for each domain.

## What staff must never do, even without a UI forcing the boundary

- Never promise a response-time SLA that isn't staffed for — this session has no basis to assert
  any real staffing commitment, and neither should support communication during a pilot.
- Never fabricate a resolution — if something isn't fixable within the beta's real scope
  (`docs/BETA_SCOPE.md`), say so plainly rather than implying it will be handled.
- Never share another user's private data (exact address, application answers, reporter identity)
  to resolve a _different_ user's complaint — the same privacy boundaries this session's own RLS
  work enforces apply just as much to a human answering email manually.

## Recommended next step, not built here

A real "Contact support" form + staff queue view is a genuine, real, buildable frontend feature —
the entire backend contract already exists and is tested. Flagged as a clear, concrete next
feature for whoever picks up frontend work next, rather than built speculatively in this pass
without a clear UI spec to build against.
