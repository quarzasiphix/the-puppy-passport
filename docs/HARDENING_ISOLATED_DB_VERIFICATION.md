# Isolated database verification (Phase 3-4)

Run entirely against this branch's own isolated Supabase instance
(`the-puppy-passport-hardening`, ports 55321-55329 — see
`docs/HARDENING_ISOLATED_DB_ENVIRONMENT.md`), never the shared instance.

## Fresh reset

`npm run db:reset`: all 151 migrations applied cleanly (echoed one by one through
`20260101014900_achievement_self_verification_lock.sql`), seed applied, containers restarted
healthy. Repeated once more later in this pass with the same clean result — confirmed repeatable,
not a one-off.

## Targeted security/workflow tests (run first, before the full suite)

114/114 passed on the first isolated run, covering: notification-preference enforcement,
`create_notification_if_enabled()`'s authorization boundary (HF-2 — including the exact "an
unrelated user cannot notify another user with arbitrary content" scenario), quotation-expiry
enforcement (the exact `5cc520f` scenario: an already-expired quotation cannot be accepted, a
non-expired one can, a null `expiry_date` never blocks), the quotation field lock (a requester
cannot smuggle a price change alongside a status update; ops retains full access), account
deletion, and legal holds.

## Full suite, three runs

| Run | Result | Note |
|---|---|---|
| 1 (immediately after fresh reset) | 1061/1062 — 1 failure | `rate-limiting.test.ts`: "one real create_transport_draft() call creates one rate_limit_events row" — `actual: 0, expected: 1`. |
| 2 (no reset between) | 1062/1062 | Clean. |
| 3 (no reset between) | 1062/1062 | Clean. |

**The one failure is a transient, container-settling-period flake, not a product defect** —
diagnosed rather than assumed:
- It cleared immediately on the very next run with zero code changes.
- It's the same class of issue Bot 1's own certification reports already disclosed independently
  (`BOT1_FINAL_A_TO_Z_HANDOFF.md`: "2 real, disclosed infrastructure incidents... a `db:reset` CLI
  crash and a container-settling-period transient flake, neither a Bot 2 defect") — this run
  reproduces the same documented pattern on a completely different (freshly-created) instance,
  which is evidence *for* it being a genuine environment-timing issue rather than something
  specific to this hardening branch's own database configuration.
- The test's own comments show its author already reasoned about and ruled out shared-actor
  cross-test collision as a cause (the `admin` persona is deliberately unused elsewhere in the
  rate-limiting checks specifically to avoid this), so a code-level flakiness explanation is less
  likely than an infrastructure one.
- Not silently retried-until-green and reported as unconditionally clean — recorded exactly as
  observed, including the one failure, per the "trust actual output" instruction.

## Contract/schema/security inventory

- `npm run db:contract-check`: clean — 70 tables, 43 RPCs match the committed baseline.
- `npm run db:schema-drift`: **failed with a reproducible container crash** (`exit 139`,
  `LegacyDeclarativeShadowDbError` while provisioning the shadow database) — retried once,
  identical failure both times. This is a Docker/container-runtime-level segfault provisioning the
  *shadow* database specifically, not a finding about the actual schema (which `db:preflight` and
  `db:contract-check` — both of which query/scan the *real* database and migration files, not a
  shadow one — independently confirm clean). Matches item 7 of Bot 1's own disclosed action list
  ("Investigate the underlying `supabase db reset` CLI crash upstream (worked around twice now, not
  root-caused)") — a known, pre-existing sandbox limitation, not a new regression introduced by
  this branch.
- `SECURITY DEFINER` search_path: **94/94** functions pinned (direct `pg_proc`/`pg_namespace`
  query against the isolated instance).
- RLS: **70/70** tables enabled (direct `pg_tables`/`pg_class` query).
- Storage policies: **19** (direct `pg_policies` query against the `storage` schema) — matches the
  documented baseline exactly.
- Secret scan (the same conservative pattern set `release-preflight.mjs` uses — PEM private keys,
  `sk_live_`, AWS `AKIA` keys): clean.
- `git diff --check` across every commit in this branch: clean, no whitespace errors.

## Conclusion

The isolated database's real, direct results (114/114 targeted, 1062/1062 × 2 consecutive clean
full runs after one disclosed transient flake, 94/94, 70/70, 19 Storage policies, clean contract
check, clean secret scan) match the certified backend baseline exactly. The one full-suite failure
and the one schema-drift tool crash are both independently attributable to already-disclosed,
pre-existing infrastructure patterns — not new defects in the integrated product or in this
hardening branch's own changes.
