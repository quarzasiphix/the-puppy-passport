# Backpressure and bounded workers audit

Stage XR-11 (append-only queue). Same real constraint already established at Stage XR-10 and
repeatedly before it: **no background job/worker pool exists anywhere in this codebase.**
"Bounded claims, deterministic ordering, retry-storm handling... local multi-worker soak" all
describe protecting a shared pool of automated workers pulling from a queue — there is no such
pool to protect.

## The one real, human-actor analog — already audited, already correctly left alone

The closest real equivalent to "a worker claims a unit of work" is
`claim_moderation_case()`/`claim_support_case()` (a human moderator/support staffer claiming a
case, not an automated worker claiming a queue item). "Stale locks" — what happens if a claimant
goes inactive and never resolves what they claimed — was already directly investigated at Stage
IR-11 and re-confirmed at Stage XR-17's targeted review: `claim_moderation_case()` deliberately has
no lease/TTL, because the broader `is_moderator()`/`is_ops_staff()` "manage all cases" policy
already gives any other moderator or admin a permanent, always-available override — a stale claim
can always be reassigned by anyone else with the role, with no timeout mechanism needed. Not
re-litigated here; re-confirmed still true by checking no migration since XR-17 touched either
claim RPC's policy shape.

## What would need to exist before this stage's own definition becomes applicable

The same honest boundary as Stage XR-10: a real background worker pool would need to exist first.
None does, and nothing in this session found a demonstrated need for one (no email provider, no
webhook dispatch, no scheduled report generation, no queue of automated async tasks of any kind).
If one is ever built, the concrete requirements this stage names should be designed in from the
start — a bounded number of concurrent claims per worker, `SELECT ... FOR UPDATE SKIP LOCKED` (the
standard Postgres pattern for exactly this) for deterministic, non-blocking claim ordering, a real
lease/TTL with automatic release on staleness, and backpressure (a max in-flight count) to prevent
a retry storm from one failing job type starving all others. Not designed speculatively here.
