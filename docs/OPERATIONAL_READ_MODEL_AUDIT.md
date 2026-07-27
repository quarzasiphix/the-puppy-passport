# Operational read-model consistency (Stage YR-17)

## Not applicable — no cached/denormalized read model exists anywhere in this schema

Checked directly:

- Every `create view` in this schema (`public_routes_view`, the public views migration,
  `transport_reviews`, `fundraising`, `moderation_appeals`, `driver_transport_job_view`) is a plain
  SQL view — always computed fresh from canonical tables on every query, never a materialized/
  cached copy. Grepped for `materialized view` specifically: zero results. A plain view cannot go
  stale relative to its own source tables by definition; there is nothing to "rebuild or refresh."
- No stored denormalized count/aggregate column exists anywhere that duplicates canonical data
  (checked for an `..._count`-shaped column that isn't a genuine user-entered input field like
  `litters.puppy_count` — found none). `listDriverWorkloads()`'s own `activeJobCount` (Stage YR-9,
  re-checked here) is computed live from a real join every call, never stored.
- Every operational dashboard this stage names — support backlog
  (`listSupportCases`-equivalent), moderation backlog (`listModerationCases`), transport queues
  (`listOpsQuotations`/dispatch queries), route assignments, expiring documents
  (`documentExpiryWarning`/`expiryWarnings`, computed live on read, Stage IR-9), notifications
  (`listMyNotifications`) — queries its canonical table directly, live, on every page load. There
  is no separate caching/read-model layer anywhere in this application to audit for drift.

This matches the same "no async/cached infrastructure exists" architecture this session has
confirmed repeatedly (XR-10/XR-11/XR-12, YR-4): every read is synchronous and live against the
canonical table. "Keep canonical tables authoritative" is already unconditionally true — there is
no alternative source of truth anywhere to compete with them.

## Verification

- No code, migration, or test change this stage — a genuine "confirmed not applicable" audit
  outcome, evidenced by a real grep sweep rather than assumed.
