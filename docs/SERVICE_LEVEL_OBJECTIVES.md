# Service Level Objectives

Stage BX of the autonomous backend-hardening session (see `docs/AUTONOMOUS_BACKEND_PROGRESS.md`).
No production Supabase project or Cloudflare deployment exists yet (see
`docs/PRODUCTION_READINESS_REPORT.md`), no real traffic has ever hit this app, and no monitoring/
observability tool is wired up. That means there is **no baseline data to justify any specific
numeric target** — a fabricated "99.9% uptime" or "p95 latency under 200ms" would be worse than no
number at all, the same "do not claim monitoring is active when it isn't" rule this session has
followed for every other launch-readiness doc (`docs/BACKUP_AND_DISASTER_RECOVERY.md`,
`docs/PRODUCTION_SETUP.md`). This document is the framework and the concrete measurement points
already available for when a real production instance exists — not a claim that any SLO is
currently being met or tracked.

## What's already measurable today, once monitoring exists

Nothing new was built for this stage beyond what earlier stages already produced — the honest
answer is that the raw material for SLIs (Service Level Indicators) already exists in the schema,
just not yet wired into any dashboard:

- **Availability**: `GET /health` (Stage BW, `src/server.ts`) — a plain, fast, cacheable-never
  endpoint any external uptime monitor (Cloudflare's own health checks, UptimeRobot/Pingdom, a load
  balancer) can poll. Returns `200 {"status":"ok","database":"reachable"}` when the Worker is up
  and Supabase is genuinely reachable, `503 {"status":"degraded",...}` otherwise — a real DB probe,
  not just "the process responded."
- **Error rate**: every RPC/trigger this session has written raises with a stable `P0001` errcode
  for expected business-rule rejections (Stage BQ) — an SLI computation should treat these as
  *client* errors (4xx-equivalent, expected, not a reliability signal), and only genuinely
  unexpected 5xx/`normalizeCatastrophicSsrResponse` paths (`src/server.ts`) as the real error-rate
  numerator once request logging exists.
- **Abuse/load volume**: `rate_limit_events` (Stage J, pruned by Stage BU) already records every
  rate-limited action attempt per actor — a real, existing signal for request volume by action type
  once someone wants to look at it, with zero unbounded growth risk.
- **Explainable anomalies**: `risk_signals` (Stage BN) already flags accounts crossing a real usage
  threshold on a rate-limited action — a starting point for an "abuse rate" SLI, not just a
  performance one.
- **Auditability**: `audit_logs` (Stage AE, actor-locked) already records every staff-side mutation
  with a real, non-forgeable actor — the raw material for a "time to action" SLI on ops workflows
  (e.g. moderation case claim → resolution, support case claim → resolution) once someone queries it
  for that purpose.
- **Data durability**: `docs/BACKUP_AND_DISASTER_RECOVERY.md` already documents the two recovery
  paths (schema replay vs. real data restore) and the concrete gaps that must be closed (a real
  PITR/backup plan tier decision) before an RPO/RTO number can be committed to.

## Proposed SLI categories for when real monitoring exists

Not targets — categories, so whoever wires up real monitoring doesn't have to re-derive what to
measure from scratch:

1. **Availability** — `/health` uptime, sampled externally (not self-reported by the Worker).
2. **Core journey latency** — the handful of flows CLAUDE.md itself names as the product's spine:
   transport request submission (`_public.transport.request.tsx` → `create_transport_draft()`),
   marketplace browse (`listPublishedPuppies()`/`listPublishedLitters()`), and the ops
   status-change path (`change_ops_request_status()`). Not every endpoint — the ones a real user
   actually waits on.
3. **Error rate** — genuine 5xx/unhandled-exception rate, explicitly excluding expected `P0001`
   business-rule rejections (a rate limit hit or a validation failure is not a reliability problem).
4. **Data durability** — backup success rate and last-verified-restore date, once a production
   Supabase plan/backup tier is actually chosen (`docs/BACKUP_AND_DISASTER_RECOVERY.md`'s own open
   item).

## What's needed before any of this becomes real

- A production Supabase project and Cloudflare Worker deployment (neither exists yet — this session
  is explicitly barred from creating one; see `docs/PRODUCTION_SETUP.md`).
- Real traffic — SLOs measured against zero real users are meaningless by construction.
- An actual observability tool wired to `/health` and to real request/error logs (Cloudflare
  Analytics, an external APM, or equivalent) — none configured yet.
- A deliberate decision, by whoever owns the launch, about what error budget/target is acceptable
  for *this* product at *this* stage — not something this session should guess at without any of
  the above in place.

Until then, this document should be read as "here's what to measure and where the raw data already
lives," not "here's what we currently guarantee."
