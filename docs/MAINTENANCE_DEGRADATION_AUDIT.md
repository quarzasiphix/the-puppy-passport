# Maintenance and degradation chaos audit (Stage YR-18)

## Maintenance mode: enforced at the edge, deliberately not at the RPC layer

`app_maintenance_mode` (Stage BZ) is real and correctly access-controlled (admin-only write,
server-stamped actor, already tested — `tests/db/maintenance-mode.test.ts`). Enforcement happens in
`src/server.ts`'s Cloudflare Worker `fetch` handler: every request to the frontend gets a real
maintenance HTML page instead of the app when `enabled = true`, with a short-TTL cache and an
explicit fail-open policy if the check itself can't reach the database (so a database outage can
never itself block the maintenance page from rendering — the one case where "fail open" is
correct, since the alternative would be a blank error page instead of a clear maintenance notice).

**Checked, per this stage's own instruction, against direct RPC/API access**: confirmed the
database itself has zero awareness of maintenance mode — no RPC or trigger anywhere reads
`app_maintenance_mode.enabled`. A client bypassing the Cloudflare Worker entirely (a direct
PostgREST/RPC call, exactly what this test suite itself does) is completely unaffected by
maintenance mode being on. This is real, but a deliberate scope boundary, not an oversight — the
original migration's own comment frames this as solving one specific, real problem ("no mechanism
existed to take the app down for a planned migration/deploy without a code change and redeploy"),
and today this app has exactly one real client (its own frontend); no public API, no mobile app, no
third-party integration exists to actually reach the database directly except a developer with
direct credentials — for whom maintenance mode blocking their own migration work would be
counterproductive, not protective.

**Not built here**: database-level enforcement (e.g., a trigger checking `app_maintenance_mode` on
every write) would be a large, cross-cutting migration touching every table's write path for a
threat this app doesn't currently have a real consumer for. If a public API or additional client is
ever added, this should be revisited then — flagged for that future decision rather than built
speculatively now.

## "Provider not configured" — already handled, checked not re-built

Google/Facebook OAuth sign-in already shows a clear, honest toast ("isn't configured on this server
yet — see docs/SOCIAL_AUTH_SETUP.md") rather than a raw failure when attempted with no real
provider configured (confirmed in `_public.signin.tsx`, already read this session). Email/payment/
fundraising providers are documented as genuinely not configured anywhere in this app
(`docs/FUNDRAISING_POLICY.md`, `docs/PRODUCTION_SETUP.md`) — no code path anywhere claims a
provider is active when it isn't.

## Storage unavailability / database readiness failure

No dedicated local-failure-injection test exists for a mid-request Storage or database outage —
this would require either a Postgres/Storage container-stop mid-test (destructive to the shared
local dev stack every other test file also depends on) or a mocked failure (which wouldn't exercise
the real code path). Given this app's existing pattern of trusting Supabase's own
infrastructure-level reliability (not re-implementing retry/circuit-breaker logic that duplicates
what PostgREST/Storage already handle), and no previous stage having built or needed local outage
injection, this is left as a documented gap rather than built speculatively — a genuine local
chaos-test harness for this would be a substantial new testing capability, not a small fix.

## "Job backlog" — not applicable

No job/worker/outbox system exists (XR-10/XR-11/XR-12/YR-4) — nothing to back up.

## Verification

- No code, migration, or test change this stage — a genuine audit outcome. The one real finding
  (RPC-layer maintenance-mode bypass) was traced to a deliberate, reasoned, already-documented
  scope boundary rather than an oversight, and left as a flagged future consideration rather than
  built speculatively for a threat this app has no real consumer for today.
