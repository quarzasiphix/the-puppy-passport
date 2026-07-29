# Incident response

General index — for domain-specific detail see `docs/ACCOUNT_SECURITY_RUNBOOK.md`,
`docs/MODERATION_RUNBOOK.md`, `docs/TRANSPORT_INCIDENT_RUNBOOK.md`,
`docs/SUPPORT_RUNBOOK.md`.

## Maintenance mode

Real, edge-enforced (`src/server.ts`'s Cloudflare Worker `fetch` handler reads
`app_maintenance_mode` with a short-TTL cache, fail-open on DB error — audited at Stage YR-18,
deliberately not RPC-layer-aware since there's exactly one real client today). To activate: flip
the flag in the database directly (no admin UI for this exists yet — a real, small future feature,
not built speculatively here).

## Database / Storage / Auth outage

No custom outage handling exists in this app beyond ordinary error states (a failed query throws,
the calling UI shows an error toast via `getFriendlyErrorMessage()` where wired). There's no
dedicated "database is down" banner or automatic retry-with-backoff layer. For a real production
incident, rely on Supabase's own platform status/monitoring once a real production project exists
(`docs/PRODUCTION_SETUP.md`) — nothing like this exists for the local dev stack, nor should it.

## Rollback

This session's own standing discipline is the real rollback story for backend changes: every
migration is additive/forward-only (never edits a committed migration), so "rollback" in practice
means writing a new corrective migration, not reverting history. For a genuinely bad release,
`git revert` of the specific commit(s) plus a fresh `db:reset` against the reverted migration set
is the real, available mechanism — not exercised as a drill in this pass, but consistent with how
this session has already handled every migration this whole engagement.

## Backup and restore

See `docs/BACKUP_AND_RESTORE_REQUIREMENTS.md` — no automated backup exists for the local dev
stack (by design; it's disposable, reproducible from migrations + seed). Production backup
strategy is not yet defined, since no production project exists.

## Post-incident review

No template exists yet for a structured post-incident writeup. Recommended minimum, matching this
session's own documentation discipline throughout: what happened, real evidence (not assumed),
what was fixed, what regression test now proves it, and what (if anything) remains open — the same
shape every entry in `docs/AUTONOMOUS_BACKEND_PROGRESS.md` already follows.
