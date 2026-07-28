# Bot 1 — Release Review (Finalisation Pass)

One row per release-readiness requirement. First-round snapshot: `26f1b2ef6b1a43315d11512e22983500dcd8e788`.
**Resumption-round snapshot (authoritative)**: `8201f17dd4c8abc36cc816d63c52f3620ae7e44f` — real-repo
`main` advanced by 5 migrations and ~26 commits mid-pass; see `docs/BOT1_FINALISATION_AUDIT.md`
§51–§57 for the full correction. Several rows below were updated by empirical live testing during
the resumption round, not carried forward from the first round unchanged.

| Requirement | Result | Evidence |
|---|---|---|
| Branch is `main`, clean at time of snapshot | Pass | `git -C /p/the-puppy-passport rev-parse HEAD` = `8201f17` (moved twice during this pass: `26f1b2e` → `2971c3b` → `8201f17`, all real, committed Bot 2 work). `git status --short` clean as of the resumption-round check (the 2 untracked files noted in the first round were committed by Bot 2 in the interim). |
| No duplicate migration prefixes | Pass | 142 migrations (up from 137), re-checked: no duplicate prefixes. |
| Migration static-safety scan | Pass (first round only; not re-run this exact moment, but the 5 new migrations were each read in full and contain no destructive pattern) | `npm run db:preflight` clean at 137 files (first round); the 5 new migrations (§54) add triggers/policies/functions only, no `drop table`/`drop column`, no `not null` column without a default. |
| RLS enabled on every public table | Pass | 70 base tables, unchanged count at both snapshots; this pass's live queries against 9+ tables across both rounds found RLS enabled and policies present on all of them. |
| `SECURITY DEFINER` functions pin `search_path` | Pass | All functions redefined by the 5 new migrations (§54) use `set search_path = public`, confirmed by reading each in full. |
| No secrets committed | Not independently re-swept this pass | Carried forward from prior passes; the two deltas reviewed this pass (docs/notification/test files, then 5 migrations + ~19 stage commits) contain no plausible secret carrier, spot-checked by reading the diffs. |
| No service-role key reachable from browser code | Not independently re-swept this pass | Same reasoning. |
| **§5.1 Fundraising self-publish** | **PASS — now fixed, live-empirically confirmed** | Corrected mid-pass: first round said "still open" (stale `26f1b2e` snapshot); resumption round attempted the live exploit as the real org owner against `HEAD` `8201f17` and it was **rejected** by a new trigger (`52637b1`/`20260101014000`). No longer a release blocker. |
| **§5.2 `legal_holds`/`account_deletion_requests` raw-write bypass** | **FAIL — release blocker, live-empirically confirmed exploitable** | Both halves (admin raw-insert forging `placed_by`; ordinary user self-raw-update to `processed` forging `processed_by`) actually executed against `HEAD` `8201f17` and succeeded. **Candidate fix available**, not applied to `main`. |
| **§5.3 `create_notification_if_enabled()` arbitrary recipient/content** | **FAIL — release blocker, live-empirically confirmed exploitable** | Actually executed as an ordinary user with zero relationship to the target; succeeded. |
| **§5.4 `moderation_cases` self-resolution** | **FAIL — release blocker, live-empirically confirmed exploitable** | Actually executed (with a temporarily-granted, then-revoked real moderator role) against `HEAD` `8201f17`; succeeded. |
| **NEW-H1 `transport_requests` raw status-flip** | **FAIL — release blocker, live-empirically confirmed exploitable** | Actually executed against a real live request in `quotation_sent`; succeeded, no reference to `quotations` at all. Still not addressed by any of the 7 new migrations found across both resumption rounds. |
| **§6.1 quotation terminal-state (RLS half)** | **FAIL — release blocker, live-empirically confirmed exploitable (upgraded from live-static this round)** | As real `customer`, flipped an already-`accepted` quotation to `rejected`, then back to `accepted` — both succeeded. |
| **§6.9 `uploaded_by` forgery** | **FAIL, live-empirically confirmed exploitable (upgraded from live-static this round)** | As real `customer`, raw-inserted a `transport_documents` row forging `uploaded_by` to `ops`'s id — succeeded. |
| **NEW-H3 `achievements.verification_status` owner self-verification** | **FAIL — new release blocker, found this round's undirected fuzz sweep, live-empirically confirmed** | As real kennel owner `breeder1`, raw-inserted an achievement pre-set to `verification_status='approved'` — succeeded, immediately publicly visible as a fabricated trust signal with zero admin review. **Candidate fix available** (`3f4db66`), not applied to `main`. |
| **§7.5 `getFriendlyErrorMessage()` wiring** | **PASS — now fixed** | Corrected mid-pass: `grep -rln getFriendlyErrorMessage src/` against the current real-repo tree now returns 33 files (was 2 at both prior Bot 1 passes' snapshots) — Stage YR-16 wired it into 32 customer-facing routes. |
| Undirected fuzz sweep (privilege escalation, anonymous exposure, cross-tenant reads, org self-promotion) | **14/15 PASS, 1 FAIL (→ NEW-H3)** | 15 probes against domains this report had not previously named a finding against — self-grant of `admin`/`moderator` roles, anonymous reads of 5 sensitive tables, cross-tenant row visibility, organisation-membership self-promotion all correctly rejected; the achievements self-verification probe succeeded (NEW-H3). Genuine positive evidence for the areas that held, not just more caution. |
| Fresh migration rehearsal (reset + seed + full suite ×3 + tsc + build) | **Partially executed** | `tsc --noEmit`/`npm run build`/`npm run db:preflight` all clean at the first-round snapshot. `npm run test:db` **not run** by this pass at any snapshot — but across both resumption rounds, real, targeted, authenticated-actor empirical exploit attempts were made against **10 findings** (8 in round 1 + §6.1/§6.9 in round 2) plus a 15-probe undirected fuzz sweep, each with cleanup verified. Bot 2's own progress log claims `1013/1013` `test:db` passing at `8201f17` (Stage FA-3) — not independently re-executed by this pass, recorded as a claim, not verified fact. |
| Candidate-fix branch, if any, isolated and never merged | Pass | `candidate-fixes/bot1-legal-hold-deletion-raw-write-20260727`, now **2 commits**: `7ba7b32` (§5.2) and `3f4db66` (NEW-H3), both still valid against `HEAD` `6dbba45`, never merged, never pushed, never applied to any live database. |
| Real backend worktree (`/p/the-puppy-passport`) untouched | Pass | Never entered/checked out at any point across both rounds; only read via `git -C /p/the-puppy-passport <read-only command>`, a read-only `cp -r .../node_modules .`, and live `psql`/authenticated-client queries against its **separate shared Supabase instance** (not the git worktree itself) — every mutation made against that instance during empirical testing was reverted and verified, restoring it to Bot 2's own unmodified state. |
| Frozen frontend worktree untouched | Pass | Never entered/checked out; ref hash re-confirmed unchanged (`727d551`) at both rounds. |

**Overall release verdict**: **Not release-ready, but genuinely closer than the first round of this
same pass reported.** 2 of the original 4 High findings + the 1 regression are now confirmed
release blockers with the *strongest* evidence tier this or either prior pass has produced
(live-empirical exploit, not policy-text tracing) — §5.2, §5.3, §5.4, NEW-H1. **§5.1 is now fixed**
and should be removed from any release-blocker list; treating it as still open (as this pass's own
first round briefly did) would be a stale, incorrect claim. The remaining blockers are specific,
well-evidenced, small-surface-area RLS/grant gaps — Bot 2's own demonstrated fix velocity this
session (5 real fixes landed in the delta window alone, including one of this exact report's own
findings) suggests these are genuinely close to resolvable, not a sign of a stuck or ignored
process — they simply haven't been pointed at yet, per §55/§56's "narrow self-audit scope" finding.
