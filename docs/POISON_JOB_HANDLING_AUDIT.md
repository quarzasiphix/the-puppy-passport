# Poison-job handling audit

Stage XR-10 (append-only queue). Re-confirmed, not assumed: **no background job/worker/queue
system exists anywhere in this codebase** (no `pg_cron`, no external scheduler, no polling worker,
no job table) — the same fact this session has independently verified at Stage BA (the original
audit), Stage BU (`rate_limit_events` archival — "no background job/scheduler exists... found no
other reachable need for one"), Stage IR-9 (document expiry — "no background job exists, so compute
staleness on read"), and Stage IR-10 (outbox/notification soak — same conclusion). Re-grepped for
`pg_cron`/`setInterval`/scheduler/worker-queue patterns across `src/`, `supabase/migrations/*.sql`,
and `package.json` this stage specifically — every hit is a comment referencing this same
already-established fact, not real infrastructure.

**Poison-job handling — terminal failure after bounded retry attempts, safe diagnostics, manual
retry, one failing job not blocking others' processing — is a concept that only applies to a real
job/worker system.** There is nothing here to protect: every "job-shaped" action in this app
(notification creation, status transitions, document review) executes synchronously within a
single request/RPC call, succeeds or fails immediately and visibly to the caller, and has no queue
position for a poisoned item to occupy or block.

## What this session has already built that's the closest real analog

Not duplicated here, cross-referenced instead:

- **Terminal-state guards** (Stage XR-8's `review_welfare_case()`, `submit_moderation_appeal()`,
  the driver status state machine) — the closest real equivalent to "an item can't get stuck in an
  unrecoverable, ambiguous state," just expressed as a synchronous RPC precondition rather than a
  retriable job.
- **Idempotent retry** (Stage XR-9) — the closest real equivalent to "bounded attempts don't
  corrupt state," just for a synchronous caller-initiated retry rather than an automatic job
  requeue.
- **Rate limiting** (`enforce_rate_limit()`, Stage J) — the closest real equivalent to "one bad
  actor's repeated attempts don't degrade the system for everyone," scoped per-actor rather than
  per-job.

## What would need to exist before this stage's own definition becomes applicable

A real background job/worker system would need to exist first (correctly still unbuilt — no
external integration currently needs one: no email provider, no webhook dispatch, no scheduled
report generation). If one is ever added, the concrete requirements this stage names should be
designed in from the start: a bounded max-attempt count, a `failed`/`dead` terminal status distinct
from `pending`/`retrying`, privacy-safe error messages stored on the job row (never a raw stack
trace or another user's data), a manual-requeue action for staff, and per-job isolation so one
poisoned item can't hold a worker slot indefinitely. Not designed speculatively here — the same
"don't build ahead of a real, approved need" discipline this session has applied to every other
not-yet-real integration (payment provider, email provider, webhooks).
