# Bot 1 — Full-Day Release Review

One row per release requirement. Source snapshot: `ac612690c1741d7879d747f7e13b40fd0cb2cc04`
(`LATEST_MAIN`, independently confirmed via `git -C /p/the-puppy-passport rev-parse HEAD` at the
start of this consolidation round).

| Requirement | Status | Evidence |
|---|---|---|
| No reachable Critical finding | **Pass** | Zero Critical findings across all four audit passes; every open High requires an actor who already holds some privilege (org owner, admin session, or the request's own requester) — a trust/abuse-vector class, not a direct cross-tenant breach. |
| §5.1 fundraising self-publish closed | **Pass** | `20260101014000_fundraising_self_publish_lock.sql`, independently re-confirmed this round via direct trigger-body read against `LATEST_MAIN`; no regression (a later migration, `20260101014300`, adds an audit trigger alongside it, does not remove or weaken it). |
| §5.2 `legal_holds`/`account_deletion_requests` raw-write bypass closed | **BLOCKS** | Still open, independently re-confirmed this round against `LATEST_MAIN` via direct grant/policy read (§4.3 of the main report). Candidate fix `7ba7b32` exists but needs its migration prefix renumbered before use (see `BOT1_CANDIDATE_FIX_LEDGER.md`). |
| §5.3 `create_notification_if_enabled()` arbitrary recipient closed | **BLOCKS** | Still open, independently re-confirmed this round via full function-body read against `LATEST_MAIN`. No candidate fix exists yet. |
| §5.4 `moderation_cases` self-resolution closed | **BLOCKS** | Still open, independently re-confirmed this round — no migration since the original finding restricts resolution by actor relationship. No candidate fix exists yet. |
| NEW-H1/H-4 `transport_requests` raw status-flip closed | **BLOCKS** | Still open, independently re-confirmed this round — the exact trigger exemption clause is unchanged, verbatim, at `LATEST_MAIN`. No candidate fix exists yet. |
| NEW-H3/H-5 `achievements.verification_status` owner self-verification closed | **BLOCKS** | Still open, independently re-confirmed this round via direct policy/trigger read against `LATEST_MAIN`. Candidate fix `3f4db66` exists, no prefix collision, applies cleanly per this round's own re-check. |
| Legal-hold propagation to self-service hard-deletes | **Pass** | `20260101014200_legal_hold_self_delete_lock.sql`, live-empirically confirmed by this clone's own prior checkpoint round (real hold, real pre-existing row, real rejection with exact migration error text). |
| `animal_ownership_history` admin-mutable closed | **Pass** | `20260101012900_history_evidence_immutability.sql`; independently re-confirmed this round no later migration re-grants UPDATE/DELETE. |
| Raw Postgres error leakage (`getFriendlyErrorMessage`) wired broadly | **Pass, with a caveat** | 34 files at `LATEST_MAIN` (re-counted this round, unchanged from last checkpoint) use it; not a 100% sweep (3 auth-flow files deliberately excluded per the fixing commit's own stated scope). Acceptable for release, not literally complete. |
| Migration hygiene | **Pass** | 145 migrations, zero duplicate prefixes at `LATEST_MAIN` (`ls supabase/migrations \| sed -E 's/^([0-9]+)_.*/\1/' \| sort \| uniq -d` → empty, re-run this round). `npm run db:preflight`'s static scanner was not independently re-run this round (relying on the finalisation pass's own recent clean result — not re-verified). |
| RLS coverage | **Pass, narrow scope re-checked** | The 9+ tables tied to open/fixed findings all have RLS enabled with at least one policy, independently re-confirmed this round via direct migration read; a full 145-table sweep was not re-run this round (relying on the finalisation pass's prior 70/70 count, itself not independently re-verified this round). |
| `SECURITY DEFINER` `search_path` pinning | **Not independently re-verified this round** | Relying on the finalisation pass's own 84/84-pinned live count (§17 of its report); no new `SECURITY DEFINER` function was found in this round's own reviewed delta (the 3 new migrations since `8201f17` add no new function of this kind — confirmed via read, each adds only triggers/an existing-shape function). |
| Test suite genuinely re-executed this round | **Not done — stated explicitly, not defaulted to silently** | The shared instance showed real non-idle activity at this round's own check (`pg_stat_activity`: 2 non-idle backends including this round's own query, i.e. at least one other real process). Combined with the coordinator's explicit "stop expanding audit breadth" instruction, this round relied on static verification for `tsc`/`build`/`lint`/`test:db`, consistent with all three prior passes' own repeated finding that this instance is under continuous concurrent use. `.github/workflows/ci.yml`'s own `database-tests` job (confirmed present and reads as genuine, §7 due-diligence review) is the closest independently-confirmed automated equivalent. |
| Frontend integration blockers cleared | **Not cleared, unchanged** | See `BOT1_FULL_DAY_INTEGRATION_REVIEW.md`. |

## Release blockers (unchanged priority order, independently re-confirmed against `LATEST_MAIN` this round)

1. NEW-H1/H-4 — `transport_requests` raw status-flip (undermines the RPC built specifically to
   prevent this transition).
2. §5.3/H-2 — `create_notification_if_enabled()` phishing primitive (zero privilege required,
   arbitrary content, real user's notification feed).
3. §5.2/H-1 — `legal_holds`/`account_deletion_requests` raw-write bypass (candidate fix available,
   needs prefix renumbering).
4. §5.4/H-3 — `moderation_cases` self-resolution.
5. NEW-H3/H-5 — `achievements.verification_status` owner self-verification (candidate fix available,
   applies cleanly).
6. §6.1 (RLS half)/§6.3/§6.4/§6.9 — Medium, all live-empirically confirmed exploitable by the
   finalisation pass, independently re-confirmed statically by this pass for §6.3/§6.4.
