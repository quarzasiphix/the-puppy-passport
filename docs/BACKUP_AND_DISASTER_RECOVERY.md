# Backup & Disaster Recovery

Stage AK of the autonomous backend-hardening session (see `docs/AUTONOMOUS_BACKEND_PROGRESS.md`).
No production Supabase project or Cloudflare deployment exists yet (see
`docs/PRODUCTION_READINESS_REPORT.md`), so nothing here describes an active backup regime — it's
the concrete procedure for local recovery today, plus exactly what must be decided and configured
once a production project exists. Nothing in this document should be read as "backups are
currently running in production" — they are not, because there is no production yet.

## What "recovery" means for this app

The database is the only stateful thing that matters for recovery — the application itself is
stateless (a Cloudflare Worker rebuilt from source on every deploy) and Storage objects are
referenced by path from database rows, so a database restore is also what restores Storage
references' meaning. Two independent things can go wrong and need different recovery paths:

1. **Schema corruption or a bad migration** — recoverable by replaying migrations from source
   control; the schema itself is fully version-controlled and reproducible.
2. **Data loss** (accidental deletion, a bad `UPDATE`/`DELETE`, corrupted rows) — only recoverable
   from an actual backup or point-in-time recovery snapshot, since migrations don't carry data.

## Local recovery today (verified, not hypothetical)

Every command below was actually run during this session, not assumed:

- **Full schema + data reset from source**: `npx supabase db reset` — drops the local database,
  replays every migration in `supabase/migrations/*.sql` in order, then runs `supabase/seed.sql`.
  This is the exact command run before every single stage this session to verify a clean baseline,
  and it is genuinely how "restore the schema from scratch" would work in any environment, local or
  production (production would additionally need a real data restore afterward — a `db reset`
  alone would leave production with only seed data, which is why this is *schema* recovery, not
  data recovery).
- **Full schema DDL dump for inspection/diffing**: `npx supabase db dump --local --schema public -f
  <path>` — used repeatedly this session (Stage L's RLS/grant audit, Stage N's index audit) to get
  a complete, current view of tables/policies/grants/functions. This is a schema dump, not a data
  backup — it captures structure, not rows.
- **No `psql` or `pg` client available in this sandbox** — confirmed while building the Stage L
  audit methodology. `npx supabase db query --local -f <file.sql>` is the working alternative for
  ad hoc read queries against the local database (used throughout Stage AG/AH/AI to debug real
  test failures against live data).

## What real backups require (not yet decided — a business/infra choice)

`docs/PRODUCTION_SETUP.md` §9 already flags this as an open decision, not a code task: Supabase's
automatic backup frequency and point-in-time recovery (PITR) window depend on the paid plan tier
chosen at production project creation. This document adds the concrete checklist for whoever makes
that decision, so it isn't rediscovered from scratch:

1. **Choose a plan tier with PITR**, not just daily snapshots — daily-only backups mean up to 24
   hours of data loss in the worst case; PITR narrows that to minutes. Record the actual RPO
   (recovery point objective — how much data loss is acceptable) the chosen tier delivers.
2. **Record the actual RTO** (recovery time objective — how long a restore takes) Supabase quotes
   for the chosen tier/region. This is a support-ticket/documentation lookup at signup time, not
   something this repo can predict.
3. **Test a real restore at least once** before launch, in a throwaway project, not just trust the
   plan's marketing description. Document what that test actually showed (how long it took, what
   data was recoverable) — do not claim restore capability without having exercised it.
4. **Storage bucket backup**: confirm whether the chosen Supabase plan's backup/PITR also covers
   Storage objects (`kennel-media`, `transport-documents`, `welfare-case-documents`,
   `message-attachments`) or only the Postgres database — these are separate systems and a
   database-only backup plan would silently exclude every uploaded document/photo. Record the
   answer here once known; do not assume.
5. **Migration-replay is not a substitute for a data backup.** `supabase db reset` recreates empty
   tables from migrations plus seed data — it recovers *schema*, never real production rows. A real
   incident recovery needs both: migrations to get the schema right, and a genuine backup/PITR
   restore to get the data back.

## Incident response (schema-level mistakes, today)

For a bad migration caught immediately, before any production data exists: since this repo is
fix-forward only (no down-migrations exist, confirmed in `docs/PRODUCTION_READINESS_REPORT.md`),
the correct response to a bad migration is a **new** migration that corrects it, never editing or
deleting the committed migration file that already ran (`docs/DATABASE_TESTING.md`'s migration
versioning section explains why: Supabase tracks only the numeric timestamp prefix, and CI already
checks for duplicate prefixes — editing history in place breaks the append-only guarantee every
other environment's migration history depends on).

## What this document deliberately does not claim

- That backups are currently active (they cannot be — no production project exists).
- A specific RPO/RTO number (not decided yet, plan-tier-dependent).
- That Storage objects are covered by the same backup mechanism as the database (unverified,
  flagged above as something to confirm, not assume).
- Legal/compliance retention requirements — see `docs/PRIVACY_DATA_LIFECYCLE.md` for what's
  already been separately audited about data lifecycle, which deliberately also avoids inventing a
  retention period.
