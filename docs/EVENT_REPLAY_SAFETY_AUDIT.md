# Event replay safety (Stage YR-5)

## No queued-event system — "replay" means client retry here

Confirmed (again) no outbox/job/event-queue system exists (XR-10/XR-11/XR-12/YR-4). "Replay" in
this codebase's real architecture means exactly one thing: a client retrying a call after a
dropped response, a timeout, or a double-click before a button disables — the same case this
session's idempotent-retry work (Stage XR-9, and the two transactional-workflow-boundaries
follow-ups) has already addressed for individual RPCs.

## The gap this stage closes: proving RPC retry + notification retry together, not just each alone

Two properties already existed in isolation:

- **RPC idempotency** (Stage XR-9): `approve_rehoming_review()` and its siblings return the
  original success on a retry rather than re-doing the write or raising a confusing error.
- **Notification deduplication** (Stage CJR): `create_notification_if_enabled()`'s `dedup_key`
  guarantees a repeated call for the same real-world event returns the original notification
  instead of creating a second one.

Neither was ever proven *together*, which is the actually reachable scenario: every real
notification call site (`approveRehomingReview()`, `sendQuotation()`, etc.) calls its RPC first,
then unconditionally calls `notifyUserFromTemplate()` afterward — on a genuine network retry, a
client re-runs *both* calls, not just one. New test
`tests/db/event-replay-safety.test.ts` proves the combination has no customer-visible duplicate:
simulating exactly what `approveRehomingReview()`'s real call site does (RPC, then notification
with its real `dedup_key`), a full retry of both calls returns the identical notification id, with
exactly one row ever existing — never two, regardless of how many times the client-side sequence
is retried.

## The other 3 named concerns — already covered, cross-referenced not duplicated

- **"Prevent replay from changing an immutable legal/security message through template drift"**:
  already guaranteed by Stage CJS's own design — rendered text is stored permanently at creation
  and never re-resolved against the template registry at read time, so a later change to
  `notification-templates.ts`'s source code can never alter a notification that already exists,
  replayed or not.
- **"Add replay tests for current, old and unsupported payload versions"**: already covered by
  Stage XR-13's test proving an unknown/future `template_version` is created and read back safely.
- **"Require explicit replay reason and actor where manual replay exists"**: not applicable — no
  manual/admin-triggered replay feature exists anywhere in this app (checked by grep, zero hits).

## Verification

- `npx tsc --noEmit`, `npx eslint tests/db/event-replay-safety.test.ts` — clean.
- New test: 5/5 passing in isolation.
- Full `npm run test:db` — see commit for exact count, verified on a fresh reset plus one more run
  without reset.
- No migration this stage (no schema change — proves an existing, already-correct combination of
  two independently-shipped mechanisms).
