# Final backend PR review

Stage IR-17 (integration-readiness queue). A targeted, evidence-based review pass across the
categories this stage names — security, races, idempotency, audit trail, Storage, error handling,
frontend conflict — rather than a literal line-by-line re-read of every commit in this session's
history (main has 217 commits since the merge-base alone; that volume makes a genuine, careful
targeted pass more valuable than a shallow pass over everything). Every check below was actually
run against the current commit; this is not a restatement of earlier stages' own conclusions.

## Storage — re-audited every bucket for the tamper-after-decision bug class IR-11 closed

IR-11 fixed `welfare-case-documents` (an org could tamper with evidence after ops had already
decided the case). Checked the other 4 buckets for the same shape:

- **`transport-documents`**: the requester's Storage policy is `for insert` only — no `for update`/
  `for delete` policy exists for the requester at all, so once uploaded, a requester can never
  overwrite or remove an object regardless of the underlying `transport_documents` row's review
  status. Already correctly locked, no gap (a stricter shape than `welfare-case-documents` had
  before IR-11, not a weaker one).
- **`transport-evidence`**: same shape — the assigned driver's policy is `for insert` only.
  Correctly locked.
- **`message-attachments`**: no equivalent "decision" concept exists for a conversation (a message
  is never "approved"/"declined" the way a welfare case or moderation decision is) — the tamper-
  after-decision bug class doesn't apply here by design, confirmed by re-reading
  `20260101008700_message_attachments_storage.sql`.
- **`kennel-media`**: purely marketing photos with `for all` org-owner access and no adjacent
  "decision" record either — an org should always be able to replace its own kennel photos; there
  is no equivalent integrity concern to `welfare-case-documents`' evidence-after-decision case.

No new Storage gap found.

## Security — re-ran the `SECURITY DEFINER` grant/search_path audit from IR-13

Re-verified `has_role()` stays revoked from `PUBLIC`/`authenticated`/`anon` after every later
migration this session added (`20260101012500`/`20260101012600` don't reopen it), and that all 77
`SECURITY DEFINER` functions in `public` (76 + this session's own `is_active_driver()`) still have
a pinned `search_path`. Both zero-row results, matching IR-13's own re-verification.

## Races/idempotency — spot-checked this session's own newest write paths

- `create_notification_if_enabled()`'s dedup path (IR-10's new `moderation_appeal_decision`
  producer) reuses the exact same atomic `insert ... on conflict do nothing` primitive CJR built
  and IR-10's own tests re-prove for the new dedup key shape — no new race surface introduced.
- `fetchActiveAssignmentCounts()` (IR-12) is a pure read; the value it returns can go stale between
  being read and a route actually being assigned, but that's the same, already-accepted "advisory
  suggestion, not a hard lock" design IR-8 confirmed for the whole matching feature (a real
  assignment still goes through `assign_request_to_route()`'s own capacity/uniqueness checks) —
  not a new gap, a correctly-scoped read.
- The `welfare_case_documents`/Storage lock (IR-11) uses the exact same `wc.status in (...)`
  predicate pattern already proven safe under Postgres MVCC by every other status-gated policy in
  this schema (evaluated against the reading transaction's committed snapshot, no
  check-then-act window inside a single statement) — no new race class introduced.

## Audit trail — confirmed no new state-changing action this session skipped it

Every real state-changing RPC/policy this session's own IR-10 through IR-16 stages touched was
either read-only (Storage/RLS lockdowns, `is_active_driver()`, matching's batched read) or already
routes through an existing audited path (`review_moderation_appeal()`'s own
`audit_logs` insert, unchanged by IR-10's addition of a notification call after it succeeds).
Nothing new needed its own audit-log entry.

## Errors — no silent failures introduced

Every new/changed function this session added (`fetchActiveAssignmentCounts`,
`notifyAppellantOfAppealDecision`, `is_active_driver`) either `throw`s on a real Postgres error
(matching this codebase's established `if (error) throw error` convention, verified directly in
each function) or has no error path to swallow at all (pure client-side computation).

## Frontend conflict — already the dedicated subject of IR-14/IR-15

Not re-litigated here; see `docs/FRONTEND_INTEGRATION_CONFLICT_MAP.md` and
`docs/FRONTEND_INTEGRATION_RUNBOOK.md`.

## Outcome

No new issue was found beyond what IR-10 through IR-16 already fixed in real time as each was
discovered. This is a genuine "reviewed, confirmed correct" result for this specific pass — the
same honest outcome shape several earlier stages in this session recorded (e.g. IR-3, IR-4, IR-8)
— not a claim that no further issue could ever exist anywhere in 217+ commits. No code, migration,
or test change this stage; `git status --short` is empty other than this new report and the
progress log update.
