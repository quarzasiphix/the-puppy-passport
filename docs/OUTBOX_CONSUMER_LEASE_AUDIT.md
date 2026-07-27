# Outbox consumer lease and recovery (Stage YR-4)

## Not applicable — no outbox/worker/job system exists in this codebase

Re-confirmed by a fresh grep sweep (`outbox`, `worker`, `job.*lease`, `claim_job` — zero real hits
anywhere in `src/` or `supabase/migrations/`), consistent with every earlier stage that already
established the same fact: XR-10 (dead-letter/poison-job handling), XR-11 (backpressure/bounded
workers), XR-12 (outbox payload versioning), and now YR-3 (locale/fallback hardening) all
independently confirmed there is no job queue, no worker pool, no lease/claim mechanism, and no
async consumer of any kind in this application. Every write path — including notification creation
(`create_notification_if_enabled()`) — is synchronous, executed inside the same request/RPC call
that triggered it, with no deferred processing step for anything to lease, claim, or recover.

This stage's entire subject — "prevent a worker from acknowledging another worker's lease,"
"prevent a stale worker from completing after a newer worker reclaimed the job" — describes a
class of bug that requires a worker pool to exist in the first place. Building one now, purely to
have infrastructure this audit could exercise, would be exactly the speculative-system-with-no-
reachable-product-workflow this session's standing discipline (and this very prompt's own explicit
"Do not build speculative systems with no reachable product workflow") forbids.

## What *does* exist and already covers the adjacent, real concern

Two real "concurrent actor" mechanisms exist and are already tested, covering the only genuinely
reachable version of this stage's concern in the current architecture:

- **`claim_moderation_case()` / `claim_support_case()`**: atomic, row-locked claim RPCs — two
  moderators/support staff racing to claim the same case can never both succeed, and a repeat claim
  by the same actor is idempotent. Tested in `tests/db/*.test.ts` (moderation/support case files).
- **`select ... for update` row locking** in every atomic decision RPC this session converted or
  audited (`review_welfare_case()`, `respond_to_quotation()`, etc.) — the same "only one concurrent
  caller wins" guarantee a lease would provide, scoped to the one row being decided, not a queue.

Neither of these is a "worker" in the sense this stage describes (a background process pulling
work off a queue) — they're synchronous, request-scoped concurrency guards, the correct shape for
an app with no async processing layer at all.

## Verification

- No code change this stage — genuine audit-only finding, matching the same honest handling
  applied to XR-10/XR-11/XR-12 and YR-3.
