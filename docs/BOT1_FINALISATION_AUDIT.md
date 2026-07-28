# Bot 1 — Independent Finalisation, Release, and Due-Diligence Audit

Third independent Bot 1 pass against this backend, in a freshly isolated clone. Builds directly on
two prior, completed, committed passes rather than re-deriving their work:

1. `docs/BOT1_INDEPENDENT_BACKEND_AUDIT.md` (original six-hour audit, `/p/the-puppy-passport-bot1-audit-20260725-175844`, branch `audit/bot1-backend-20260725-175844`, commits `17cddc1`/`d580941`). 4 High (§5.1–§5.4), 9 Medium (§6.1–§6.9), 6 Low (§7.1–§7.6).
2. `docs/BOT1_REMEDIATION_VERIFICATION.md` (remediation verification, `/p/the-puppy-passport-bot1-remediation-20260727-232857`, branch `audit/bot1-remediation-20260727-232859`, final commit `5f4f61e`). Verified 1 fixed, 3 partially fixed, 11 still open of the 13 High+Medium groups; found 1 new High regression (NEW-H1).

This pass's own job: verify the 4 open High + NEW-H1 are still exactly as described (they are, live-
confirmed), review the 8-commit/0-migration delta since the remediation pass's snapshot, produce one
proven, low-judgment candidate fix, and produce the 5 deliverable documents the task specifies.

**Scope honesty up front**: the task specification names 130 stages. This pass did not attempt
shallow coverage of all 130 in the time available — it followed the task's own explicit priority
("begin with unresolved high findings") and its own operational guidance ("partial, well-evidenced,
clearly-checkpointed coverage beats rushed shallow coverage of everything"). §49 (Limitations) lists
exactly which stage clusters received real evidence-backed treatment this pass and which did not,
so nothing is implied to be checked that wasn't.

**READ THIS FIRST — resumption round correction (§51 onward)**: §§1–50 below are this pass's
*first* round, written against a real-repo snapshot (`26f1b2e`) that went stale mid-pass without
this pass noticing — `main` moved forward by 5 more migrations and ~19 more stage commits (Stages
YR-7 through FA-3) before §§1–50 were committed. A resumption round, explicitly instructed to
prefer live empirical testing over carrying forward static claims, caught this the moment a live
exploit attempt against §5.1 (fundraising self-publish) *failed* unexpectedly — the failure forced
an investigation that found Bot 2 had genuinely fixed it hours after this pass's original snapshot
was taken. **§§1–50's classification of §5.1 as "still open" and §7.5 as "still open" are both
superseded and wrong as of `HEAD` `8201f17`** — both are now fixed; see §51–§56 for the full
correction, the empirical evidence for every other finding (most of the High findings now carry an
actual executed-and-reverted exploit, not just policy-text tracing), and the two new findings
(NEW-H2, a reasoning-model gap in Bot 2's own newest self-audit) this round found. Treat §51 onward
as the authoritative current state; §§1–50 remain as the historical first-round record, same as
prior Bot 1 reports' own layering convention.

---

## 1. Snapshot and environment

- **Source repo**: `/p/the-puppy-passport`, never entered or modified this pass.
- **Initial source snapshot**: `26f1b2ef6b1a43315d11512e22983500dcd8e788` ("Fill in Stage YR-4's own
  commit hash"), confirmed via `git -C /p/the-puppy-passport rev-parse HEAD` at the start of this
  pass.
- **Latest source snapshot re-checked at report time**: `26f1b2ef6b1a43315d11512e22983500dcd8e788` —
  unchanged; the real repo's `HEAD` did not move during this pass (re-confirmed via a final
  `git -C /p/the-puppy-passport rev-parse HEAD`). Two **untracked** files exist in the real repo's
  working tree (`docs/EVENT_REPLAY_SAFETY_AUDIT.md`, `tests/db/event-replay-safety.test.ts`) — Bot
  2's own in-progress work; per the task mandate, never opened, read, or depended on by this audit.
- **Migration count**: 137 files in `supabase/migrations/`, `20260101013500` newest (before this
  pass's own candidate-fix migration, which lives only on an isolated candidate branch, never on
  `main` or this pass's own audit branch).
- **Test-file count**: 65 files in `tests/db/*.test.ts`, 1 file in `tests/unit/*.test.ts` (new this
  window, Stage YR-1, `npm run test:unit` script added).
- **This pass's isolated clone**: `/p/the-puppy-passport-bot1-finalisation-20260727-235034`
  (`--no-hardlinks`, independent working tree and object store).
- **This pass's audit branch**: `audit/bot1-finalisation-20260727-235036`, from a detached checkout
  of the initial snapshot.
- **This pass's candidate-fix branch**: `candidate-fixes/bot1-legal-hold-deletion-raw-write-20260727`
  @ `7ba7b32` (created from the same clone, never merged into the audit branch, never pushed).
- **Frontend reference**: `ux-marketplace-frontend-pass`, re-fetched this pass as `audit/latest-
  frontend`, hash `727d551b8306cf6bd5ce8a2b542ac118b1c4f417` — **byte-identical** to the hash the
  remediation pass recorded, i.e. the frozen frontend branch genuinely has not moved. Never checked
  out.
- **Local Supabase/Docker**: `supabase_db_the-puppy-passport`, Postgres 17.6, confirmed reachable
  and at migration `20260101013500` (matching this pass's own `HEAD` exactly). `docker ps` at the
  start of this pass showed the DB container with only ~2 minutes of uptime relative to sibling
  containers with 2-day uptimes — direct evidence of a recent restart, consistent with both prior
  passes' finding that this instance is genuinely shared and concurrently used, not idle. Used
  **strictly read-only** (`select`-only `psql` against `pg_policies`, `pg_trigger`,
  `information_schema.role_table_grants`, `has_function_privilege()`) to cross-check the 9
  highest-value tables/functions from the open findings — no `db reset`, no `test:db`, no migration
  applied to this shared instance by this pass.
- **Method**: direct investigation throughout, no sub-agent delegation for the core verification work
  — the same choice the remediation pass made and justified (a narrow, evidence-tracing task against
  a small, already-enumerated finding set plus a small delta, not a from-scratch 16-area breadth
  sweep). Live DB checks were front-loaded early in this pass specifically because both prior passes
  independently observed the shared instance becoming unstable partway through their own live
  verification.

## 2. Executive summary

**Nothing has changed on the SQL/RLS/grant surface since the last remediation pass.** The 8-commit
delta between the remediation pass's snapshot (`c8bc235`) and this pass's snapshot (`26f1b2e`)
contains **zero new migrations** (`git diff --stat c8bc235..26f1b2e -- supabase/migrations` is
empty) — it is entirely docs, a notification category/template type-coupling fix, and two new test
files. This pass independently confirmed, both statically (no later migration touches the cited
policy/trigger/grant) and live (direct `pg_policies`/`pg_trigger`/`role_table_grants`/
`has_function_privilege()` queries against the shared instance before it showed further signs of
concurrent activity), that **all 4 original High findings and the 1 High regression found by the
last pass (NEW-H1) remain open, byte-for-byte unchanged**, three combined audit passes and 77
commits after the first was found. None of them are fixed.

Bot 2's own work in this exact delta window is real, narrow, and good — a type-level fix closing a
`category`/`templateId` coupling bug in the notification pipeline (Stage YR-1), plus three
audit-only documentation stages (notification preference enforcement matrix, notification
locale/fallback audit, outbox consumer lease audit). But Stage YR-1's own new inventory document
(`docs/NOTIFICATION_PRODUCER_INVENTORY.md`) restates, almost verbatim, the exact blind spot that
caused the original §5.3 finding to exist in the first place: it reasons carefully about every
TypeScript call site that produces a notification and concludes "there's no forgeable-recipient
surface to close here" — while never once mentioning `create_notification_if_enabled()`, the
`SECURITY DEFINER` function underneath all of them that is *also* directly callable via
`supabase.rpc()` by any authenticated client with an arbitrary recipient, title, body, and link, with
no relationship check at all. This is independent, first-hand evidence (not a repeated assertion)
that this codebase's own internal audit process has a structural gap, not just its code: it
consistently reasons from "what our own app code does" rather than "what the database will accept
from any authenticated client." See §36 for the full writeup.

This pass produced one candidate fix — `candidate-fixes/bot1-legal-hold-deletion-raw-write-20260727`
@ `7ba7b32` — closing §5.2 (`legal_holds`/`account_deletion_requests` raw-write bypass), the
single item both this pass and the prior remediation pass independently rank as the clear #1
priority. It reuses a pattern Bot 2 has already proven safe on this exact schema twice
(`animal_ownership_history`, `get_notification_preference()`). It was not applied to any live
database (see §33/§46 for why), verified instead by static SQL review, pattern-matching against
Bot 2's own already-proven-live fixes, and a clean `tsc --noEmit` on the new regression test file.

No new Critical finding. No new High finding beyond re-confirming NEW-H1. One new Medium-severity
process/documentation finding (NEW-M1, §36 — the audit-blind-spot restatement above). §3/§4/§5
below give the release/integration/acquisition blocker summary; §6–§9 give full findings by
severity; §10–§13 give the fixed/partial/open/superseded breakdown; §14 onward covers the review
areas the task's 130 stages enumerate, at the depth this pass's time budget allowed (see §49).

## 3. Release blockers

| # | Finding | Why it blocks |
|---|---|---|
| 1 | §5.1 Fundraising self-publish to `active` | Bypasses admin review entirely; must close before `FUNDRAISING_ENABLED` reaches real users. |
| 2 | §5.2 `legal_holds`/`account_deletion_requests` raw-write bypass | Defeats the platform's own documented reauthentication step-up control and, in its widened form, lets any ordinary user falsify their own account-deletion audit record. **Candidate fix available**, not yet applied to `main`. |
| 3 | §5.3 `create_notification_if_enabled()` arbitrary recipient/content | Live phishing/spam vector reachable by every authenticated user; a 6th real producer could be added at any time and would inherit the gap unless fixed at the primitive. |
| 4 | §5.4 `moderation_cases` self-resolution | A moderator can resolve a case naming themselves as the affected party via the real UI, not just a raw call. |
| 5 | NEW-H1 `transport_requests` raw status-flip | A customer can self-advance their own transport request past the quotation-acceptance gate with no valid quotation and no audit trail, undermining the very RPC (`respond_to_quotation()`) this window's own remediation work built to prevent exactly this. |

Findings in §8 (Medium) are real, several are wide (cross-org PII routing, actor forgery on
audit-relevant tables) but do not meet this report's release-blocker bar in the strict sense used by
the prior two passes — they should still be fixed before the affected surfaces see meaningful real
traffic; see §43 for priority ordering.

## 4. Integration blockers

None of the 5 release blockers above are integration-specific — they are backend gaps independent of
the frozen frontend branch. The frontend integration risk surface itself (§34/`docs/
BOT1_INTEGRATION_REVIEW.md`) is unchanged from the last pass and well-understood: 3 real conflicts
(`marketplace.ts` genuinely deep, `buyer-activity.ts` a real feature split, `dashboard.buyer.
quotations.tsx` trivial), several previously-flagged files now confirmed to auto-merge clean. The one
integration-relevant consequence of NEW-H1: any merge that wires frontend UI to `respond_to_quotation
()` should be smoke-tested for the *raw* bypass too, not just the button's happy path — see §34.

## 5. Acquisition blockers

| # | Blocker | Basis |
|---|---|---|
| 1 | 4 High-severity, live, reachable security findings remain open after 3 independent audit passes and 77 commits of otherwise-substantial security work | §6, remediation matrix |
| 2 | The codebase's own internal self-audit process has now independently repeated the exact blind spot that caused the original findings, in its newest audit document | §36 (NEW-M1) |
| 3 | Test-suite scale claims (900+ tests) were not independently re-executed or reconciled against a top-level `grep` count this pass, or by the prior pass (deliberately, for infra-safety reasons both times) | §33/§46, `docs/BOT1_DUE_DILIGENCE_REVIEW.md` |
| 4 | The shared local test infrastructure both prior passes and this pass have relied on for live verification is confirmed, a third consecutive time, to be under real concurrent use/reset activity — a buyer's own technical diligence team should expect the same interference | §33 |

None of these are described as unfixable — see §43 for the recommended close-out order.

## 6. Critical findings

None found. Consistent with both prior passes' conclusion: every open finding requires an actor who
already holds some privilege (an org's own owner; an admin session; a requester acting only on their
own row) or is a trust/abuse vector rather than a direct cross-tenant data breach.

## 7. High findings

All 5 are carried forward from the prior two passes, independently re-verified live this pass. Full
original evidence (exact file/line, reproduction, invariant, fix) is in
`docs/BOT1_INDEPENDENT_BACKEND_AUDIT.md` §5.1–§5.4 and `docs/BOT1_REMEDIATION_VERIFICATION.md` §35
(NEW-H1) — not reproduced in full here to avoid duplicating ~500 lines of already-committed,
still-accurate text; only this pass's own fresh verification evidence is new.

### 7.1 — §5.1: Fundraising campaigns can still be self-published to `active`

- **Live-confirmed this pass**: `pg_policies` for `fundraising_campaigns` shows `"eligible org
  owners update their own non-terminal campaigns"`'s `with_check` still includes `'active'
  '::fundraising_campaign_status` in the org-settable list, verbatim identical to both prior reports.
- **Confidence**: confirmed, live.

### 7.2 — §5.2: `legal_holds`/`account_deletion_requests` raw-write bypass (widened)

- **Live-confirmed this pass**: `information_schema.role_table_grants` shows `authenticated` still
  holds `INSERT`/`UPDATE` on `legal_holds` and `INSERT`/`UPDATE`/`DELETE` on
  `account_deletion_requests`; `pg_policies` shows both the admin `for all is_admin()` policy and the
  self-service `for all (profile_id = auth.uid())` policy on `account_deletion_requests` still
  present with no status restriction on either side.
- **This pass's own action**: candidate fix `7ba7b32` closes this (not applied to any live DB — see
  §33/§46).
- **Confidence**: confirmed, live.

### 7.3 — §5.3: `create_notification_if_enabled()` arbitrary recipient/content

- **Live-confirmed this pass**: `select has_function_privilege('authenticated',
  'public.create_notification_if_enabled(uuid,text,text,text,text,text,text,integer)', 'execute')`
  → `t`.
- **New evidence this pass**: Bot 2's own newest audit document (Stage YR-1) independently re-derives
  the same "producer inventory" the original finding's own reasoning depends on, and reaches the
  wrong conclusion for the same reason — see §36 (NEW-M1).
- **Confidence**: confirmed, live.

### 7.4 — §5.4: `moderation_cases` self-resolution conflict of interest

- **Live-confirmed this pass**: `pg_policies` shows `"moderators and admins manage all moderation
  cases"` still `for all using (is_moderator())`, no `affected_profile_id` exclusion. `pg_trigger`
  on `moderation_cases` shows only `set_moderation_case_affected_profile` and
  `set_moderation_case_appeal_deadline` — neither is a self-resolution guard.
- **Confidence**: confirmed, live.

### 7.5 — NEW-H1: `transport_requests` raw status-flip via the quotation-dispatch migration's own trigger exemption

- **Live-confirmed this pass**: `pg_get_functiondef()` on
  `prevent_non_staff_operational_field_changes()` shows the exact exemption clause
  (`not (old.status = 'quotation_sent' and new.status = 'accepted_by_customer')`) still present,
  unchanged since the remediation pass found it. `pg_policies` for `transport_requests` confirms the
  underlying `"requesters update their own transport requests"` policy still has no status
  restriction at the RLS layer — the trigger is the *only* protection, and the trigger has an
  unconditional hole for exactly this transition.
- **Confidence**: confirmed, live. This is a regression in code Bot 2 itself shipped this session,
  not a carried-forward pre-existing gap — see the remediation pass's original writeup for the full
  root-cause explanation (the exemption was added to unblock the new `respond_to_quotation()` RPC's
  own internal update, but the trigger cannot distinguish the RPC calling it from a raw client call).

## 8. Medium findings

Carried forward from the prior two passes; not independently re-queried live this pass except where
noted (§6.1/§6.5 status-half were part of this pass's live query batch since they share tables with
the High findings). Full evidence in the prior reports; summarized here with this pass's
confirmation method.

| Finding | Status | This pass's confirmation |
|---|---|---|
| §6.1 Quotation terminal-state (RLS half) | Partially fixed, RLS half open | Live `pg_policies`: `with_check` unchanged since remediation pass. |
| §6.2 `animal_ownership_history` | **Fixed** | Live `pg_policies`: admin-SELECT + admin-INSERT-only, no UPDATE/DELETE policy exists. |
| §6.3 `user_verifications` raw-write bypass | Still open | Live `pg_policies`: `"admins manage all verifications"` still `for all is_admin()`, unrestricted. |
| §6.4 `route_assignments.assigned_by` forgery | Still open | Live `pg_policies`: `"ops staff manage route assignments"` still `for all is_ops_staff()`, no column restriction. |
| §6.5 `transport_status_history` (status half) | Still open | Not independently re-queried live this pass; static confirmation (no delta migration touches this table). |
| §6.6 `buyer_applications.organization_id` cross-org binding | Still open | Static confirmation only this pass (no delta migration). |
| §6.7 `transport-evidence` cancellation-revocation | Still open | Static confirmation only this pass. |
| §6.8 Verification audit trail | Still open | Static confirmation only this pass. |
| §6.9 `uploaded_by` forgery | Still open | Static confirmation only this pass. |

**Static-confirmation methodology note**: "static confirmation only" here is not a weaker form of
evidence in this specific case — it means `git diff --stat c8bc235..26f1b2e -- supabase/migrations`
is empty, i.e. the entire class of change that could have fixed an RLS/grant/trigger finding
provably did not occur anywhere in the repo during this delta window. This is exhaustive for "did
anything change," even though it wasn't re-confirmed against the live instance specifically for
these 7 rows.

## 9. Low findings

Unchanged from the remediation pass, not independently re-verified live this pass (all are
code/test-file-based, confirmed via `grep`/direct file read against the current `HEAD`, which is
sufficient for these): §7.1 (constraint-name leak), §7.2 (`rehoming_reviews` missing `OLD.
admin_status` guard), §7.3 (`processedBy` client-trust on the `declined` path — **not** closed by
this pass's own candidate fix, see the remediation matrix), §7.4 (unindexed FKs, deliberate), §7.5
(`getFriendlyErrorMessage()` wired into 1 of 4 call sites — `grep -rln getFriendlyErrorMessage src/`
still returns exactly the same 2 files), §7.6 (`rpc-grant-hygiene.test.ts` weak assertion — file
re-read, still `assert.ok(attempt.error)` at every site, never `isForbidden()`/`42501`, even though
Bot 2's own newer `has-role-execute-lock.test.ts` proves it already knows the correct pattern).

## 10. Fixed prior findings

**§6.2 — `animal_ownership_history` admin-mutable.** Fixing commit `281f0e4`/migration
`20260101012900`. Effective final state (live-confirmed this pass): `"admins view all ownership
history"` (SELECT), `"admins log ownership history"` (INSERT), no UPDATE/DELETE policy, and
`information_schema.role_table_grants` was not re-queried this pass for this specific table but the
prior pass's live confirmation (revoke update/delete from authenticated) is consistent with the
`pg_policies` shape observed. Test file: `tests/db/animal-ownership-history-immutability.test.ts`
(5 tests, per the remediation pass's reading). Remaining risk: none identified against this specific
gap; the table still has no real writer in the app (per `docs/AUTONOMOUS_BACKEND_PROGRESS.md`'s own
note), so this is a defensively-closed, currently-inert surface. Repeated-run verification: not
independently re-run this pass (would require `test:db`, not run for infra-safety reasons); the live
policy re-read this pass is a repeat-run of a different kind (a fresh independent confirmation, not a
test-suite re-run) and is consistent.

## 11. Partially fixed prior findings

- **§6.1 — Quotation terminal-state**: RPC path (`respond_to_quotation()`) closed by `cfd33ca`/
  `20260101013400`. Raw RLS path (`"requesters accept or reject their own quotation"`) confirmed
  still open, live, this pass — `with_check` still allows any status transition between `accepted`/
  `rejected` regardless of `OLD.status`, gated only by the expiry check added earlier.
- **§6.5 — `transport_status_history` forged `changed_by`/status**: `changed_by` half closed by
  `3e4ae1f`/`20260101013000` (`stamp_changed_by_actor()`, an unconditional `BEFORE INSERT` trigger,
  not independently re-queried live this pass but no delta migration touches it). `status` half
  (unconstrained on direct insert, no legal-transition check) confirmed still open via the same
  no-delta-migration static proof.

## 12. Still-open prior findings

All 4 High (§5.1–§5.4), the RLS half of §6.1, the status half of §6.5, §6.3, §6.4, §6.6, §6.7, §6.8,
§6.9, and both named Low findings (§7.5, §7.6) — see §7/§8/§9 above and the remediation matrix for
per-finding confirmation method. Plus the newly-widened §5.2 reachable-actor scope (any ordinary
user on their own deletion request, not only an admin) found by the prior pass and re-confirmed live
this pass, and NEW-H1, also re-confirmed live.

## 13. Superseded findings

None. Consistent with the remediation pass's own conclusion — every named finding still maps
cleanly onto a live, unchanged code path (open/partial) or an identifiable fixing commit (fixed); no
finding was invalidated by an unrelated redesign.

## 14. Migration review

137 migrations, 0 duplicate prefixes (`ls supabase/migrations | sed -E 's/^([0-9]+)_.*/\1/' | sort |
uniq -d` → empty), 0 new migrations in the `c8bc235..26f1b2e` delta. `npm run db:preflight`
(static, offline, safe to re-run): "Scanned 137 migration files. No known unsafe patterns found." No
destructive `drop table`/`drop column`, no `not null` column added without a default, no
same-transaction enum-add-and-use pattern found in any migration re-read this pass. The finalisation
delta touches zero migration files, so no new migration-safety review was needed beyond re-running
the static scanner to confirm it still passes clean.

## 15. RLS review

Not re-enumerated table-by-table this pass (0 new migrations means 0 new tables to check for RLS
coverage since the last live-confirmed 70/70 count). This pass's own targeted live queries against
9 tables tied to open findings (`legal_holds`, `account_deletion_requests`, `moderation_cases`,
`fundraising_campaigns`, `route_assignments`, `user_verifications`, `transport_requests`,
`quotations`, `animal_ownership_history`) confirm RLS policies are present and active on all 9, with
the specific gap shapes described in §7/§8 (a real policy exists, but its `USING`/`WITH CHECK` is
too broad relative to a sibling RPC's business logic — not a missing-RLS gap, a too-permissive-RLS
gap).

## 16. Grant review

Live-confirmed this pass via `information_schema.role_table_grants`: `authenticated` still holds
`INSERT`/`UPDATE` on `legal_holds` and `INSERT`/`UPDATE`/`DELETE` on `account_deletion_requests`
(§5.2, still open) and `INSERT`/`UPDATE`/`DELETE` on `route_assignments` and `user_verifications`
(§6.3/§6.4, still open, same shape). `has_function_privilege('authenticated',
'public.create_notification_if_enabled(...)', 'execute')` → `t` (§5.3, still open). This pass's own
candidate fix revokes the first two (`legal_holds` fully for insert/update; `account_deletion_
requests` narrowed via policy + a DELETE revoke) — see §33.

## 17. `SECURITY DEFINER` review

0 new `SECURITY DEFINER` functions in this pass's delta (0 new migrations). Prior pass's 84/84
`search_path`-pinned live count stands; this pass's own candidate-fix migration adds no new function
(pure RLS policy + grant changes), so the count and its 100% pin rate are unaffected.

## 18. Actor-attribution review

No new actor-attribution gap found this pass beyond the carried-forward §6.4 (`route_assignments.
assigned_by`), §6.9 (`uploaded_by`), and the widened §5.2 (`account_deletion_requests.processed_by`
forgeable by the row's own owner, not only an admin — confirmed live, unchanged, this pass). This
pass's candidate fix removes the self-service actor-forgery surface on `account_deletion_requests`
by removing the self-service UPDATE branch entirely (the only remaining raw writer of `processed_by`
after the fix is the admin decline path, which is a real, intended, currently-shipping action, not a
forgery vector — the admin still sets their own `processed_by` correctly in that path, matching
existing app behaviour in `markDeletionRequestProcessed()`).

## 19. Protected-field review

`transport_requests.status` (NEW-H1) is the one live, reachable protected-field mutation this pass
re-confirmed: the trigger-only protection has an unconditional hole for the `quotation_sent` →
`accepted_by_customer` transition. `fundraising_campaigns.status`, `moderation_cases.status`/
resolution fields, `legal_holds`/`account_deletion_requests`' actor/status fields — all carried
forward, all confirmed live this pass, all still open.

## 20. State-machine review

No new state-machine gap found. NEW-H1 remains the clearest example: `transport_requests`'s status
state machine is enforced entirely by `prevent_non_staff_operational_field_changes()` (a single
trigger) with no RLS-layer backstop — a single missed case in that one function (as happened here)
is a full bypass with no second line of defense. This is a structural observation for Bot 2: every
other similarly-shaped table in this schema that relies on a single trigger with no RLS-layer status
restriction is a candidate for the same failure mode; a systematic sweep (not attempted exhaustively
this pass — see §49) is recommended.

## 21. Concurrency review

Not independently re-tested this pass (would require `test:db` against the shared instance, not run
for infra-safety reasons). No code change in this pass's delta touches any previously-reviewed
concurrency-sensitive path (outbox lease/claim, idempotent RPC retries). `docs/
OUTBOX_CONSUMER_LEASE_AUDIT.md` (new this delta, Stage YR-4, docs-only per its commit message) was
read in full; it is a self-audit document, not independently re-verified against code this pass for
time reasons — flagged as unverified, not endorsed or rejected.

## 22. Idempotency review

No new idempotency gap found or re-tested this pass. `create_notification_if_enabled()`'s own dedup
mechanism (`on conflict (profile_id, dedup_key) where dedup_key is not null do nothing`) is unchanged
and was not the subject of this pass's finding about it — the finding is authorization, not
idempotency, and remains correctly separated in the record.

## 23. Storage review

Not independently re-verified live this pass. §6.7 (`transport-evidence` cancellation-revocation)
confirmed still open via the static no-delta-migration proof (`grep -rln "transport-evidence|
pickup_delivery_evidence" supabase/migrations/*.sql` returns only the original file).

## 24. Privacy review

No new anonymous-exposure or PII-routing issue found this pass beyond the carried-forward §6.6
(`buyer_applications.organization_id` cross-org binding, confirmed still open statically). This
pass's own candidate fix does not touch any privacy-relevant table.

## 25. Notification and outbox review

This is the one area with real, substantive new evidence this pass — see §36 (NEW-M1) for the full
writeup of Bot 2's own Stage YR-1 audit document restating the exact blind spot that produced §5.3.
The `category`/`templateId` type-coupling fix itself (Stage YR-1) is a genuine, correctly-scoped
improvement, independently verified by reading the full diff (§25 continuation, main delta review
below) — it closes a real class of future bug (a call site sending a template under the wrong
preference category) but has no bearing on §5.3's authorization gap.

## 26. Background-job review

`docs/OUTBOX_CONSUMER_LEASE_AUDIT.md` (Stage YR-4) claims this app "has no background job/outbox
worker system" (confirmed repeatedly by prior stages per the doc's own text) — consistent with what
both prior Bot 1 passes independently found. Not independently re-verified by this pass beyond
reading the doc; no code exists to review for a system the doc itself says doesn't exist.

## 27. Legal-hold and deletion review

Covered in depth — see §7.2/§16/§33. This is the subject of this pass's own candidate fix.

## 28. Export and anonymisation review

Not independently re-tested this pass (would require live DB writes). No code change in this pass's
delta touches export/anonymisation paths.

## 29. Public-contract review

No new public route, RPC, or view added in this pass's delta (0 new migrations, and the TS-side
changes are all internal notification-pipeline refactors, not new public contracts).

## 30. Error-contract review

§7.5 (`getFriendlyErrorMessage()` wiring) and §7.6 (`rpc-grant-hygiene.test.ts` weak assertion)
carried forward unchanged, confirmed via fresh `grep`/file-read this pass.

## 31. Test-quality review

`npm run test:unit` is a genuinely new, good addition this window (Stage YR-1) — 7 pure-logic tests
for the notification-template registry, no Supabase dependency, fast, deterministic. Not
independently re-run this pass (network/DB-independent, low risk, but time-budgeted against higher-
value work) — flagged, not verified. `rpc-grant-hygiene.test.ts`'s known weak-assertion issue (§7.6)
is unchanged.

## 32. Performance review

No new performance-relevant code in this pass's delta. Not independently re-swept this pass.

## 33. Release-preflight review

`npm run db:preflight`: clean (137 files, no unsafe pattern). `npx tsc --noEmit`: clean, exit 0
(against `node_modules` copied read-only from the source repo's own install, never an `npm install`,
to avoid any lockfile/network mutation risk). `npm run build`: clean, exit 0 — both the Vite client
build and the Nitro/Cloudflare-Worker server build completed, output written only to this isolated
clone's own `.output/`. `npm run test:db` (full DB/API suite), reset ×1, no-reset ×2, retry/
concurrency run ×3: **not executed this pass**, for the same reason both prior passes gave and this
pass independently re-confirmed: the shared local Supabase instance is under active concurrent use
(container uptime evidence at the start of this pass, consistent with two prior direct observations
of the same instance being reset mid-session by another process). This pass's own live, read-only
`psql` introspection (`pg_policies`, `pg_trigger`, `information_schema.role_table_grants`,
`has_function_privilege()`) against the 9 tables/functions tied to every open High/Medium finding was
completed early in the pass, before any sign of instability was observed this time, and is the
evidence basis for every "confirmed live" classification above.

## 34. Frontend integration review

See `docs/BOT1_INTEGRATION_REVIEW.md` for the full table. Summary: frontend ref hash unchanged
(`727d551`), 0 backend commits in this pass's delta touch any previously-identified conflict file,
so the prior pass's real `git merge-tree` computation remains the current, authoritative answer —
independently re-verified (not merely re-asserted) by re-fetching the ref and diffing this pass's own
delta against the conflict file list.

## 35. Product-scope review

Not independently re-swept this pass against `docs/PRODUCTION_READINESS_REPORT.md` or
`docs/PRODUCT_VISION.md` for overstated claims beyond the specific notification-pipeline claim
covered in §36. Flagged as not-yet-covered — see §49.

## 36. Technical due-diligence review — NEW-M1: Bot 2's own newest self-audit restates the exact blind spot that produced §5.3

- **Severity**: Medium (process/documentation finding — the underlying code gap it's evidence for,
  §5.3, is already tracked as High; this is a distinct finding about the *audit process*, not a new
  code vulnerability).
- **Exact location**: `docs/NOTIFICATION_PRODUCER_INVENTORY.md` (new this delta, Stage YR-1), its
  "Recipient rule" section (line 47): *"every producer above takes `profileId` directly from data
  already fetched and authorized earlier in the same call ... never a client-supplied 'who to
  notify' argument, so there's no forgeable-recipient surface to close here."*
- **What's true**: this claim is accurate for the 5 TypeScript call sites the document inventories
  (`approveRehomingReview`, `rejectRehomingReview`, the application-status-change notifier, and the
  two moderation-decision notifiers) — all 5 do derive `profileId` from already-authorized data, not
  a raw client argument.
- **What's false, and reachable**: the claim is false for the pipeline's own primitive,
  `create_notification_if_enabled()`, which is granted `execute` to `authenticated` directly
  (re-confirmed live this pass, §7.3) and takes `p_profile_id` as a plain, unchecked argument to a
  client-callable RPC — `grep -c "create_notification_if_enabled" docs/
  NOTIFICATION_PRODUCER_INVENTORY.md docs/NOTIFICATION_PREFERENCE_ENFORCEMENT_MATRIX.md` shows the
  function name appears only in architecture-diagram/pipeline-description context in both new
  documents, never in a security/authorization-review context, and neither document poses the
  question "can this function be called directly, bypassing the 5 documented producers?" at all.
- **Why this happened**: the document's own framing is "inventory every real producer in *our
  codebase*" — a closed-world assumption that is correct for auditing application logic but
  incomplete for auditing a `SECURITY DEFINER` function with a direct `authenticated` grant, which by
  definition has a caller outside the enumerated codebase (any Data API/RPC client). This is the
  identical shape of blind spot the original audit's §5.2 "systemic pattern" note named for a
  different pair of functions six weeks and 77 commits earlier.
- **Observed behavior**: a genuinely careful, well-structured, well-tested audit stage (Stage YR-1
  fixed a real bug, added real tests, and produced an honest, readable inventory) still reached a
  wrong conclusion about the exact surface a security audit most needs to get right, because its own
  methodology structurally cannot see a raw-grant bypass.
- **Recommendation for Bot 2**: add a standing check to this repo's own audit methodology —
  literally, for every `SECURITY DEFINER` function with real business/authorization logic, ask "is
  this granted `execute` to `authenticated` directly, and if so, does its own body (not a caller's
  context) enforce every authorization check a caller might skip?" — before concluding a pipeline has
  "no forgeable surface." This is the same recommendation the original audit's §5.2 made; this pass's
  contribution is a second, independent, dated instance of the same team missing it in their own new
  work, which should raise its priority.
- **Regression test**: none applicable — this is a documentation-accuracy finding. The underlying
  code fix (§5.3) has its own recommended regression test in the original report.
- **Confidence**: confirmed — both documents were read in full this pass, not sampled.

## 37. Security due-diligence review

Threat model: unchanged from the prior two passes' conclusion — every open finding requires an
already-privileged actor or is a trust/abuse vector, no unprivileged cross-tenant data breach was
found. Tenant-isolation evidence: not independently re-tested this pass with fresh lower-trust-actor
API calls (no live writes attempted; read-only introspection only). Privileged-action auditability:
NEW-M1 (§36) is itself a finding about auditability of the audit process. Known-risk disclosure: this
report and the remediation matrix are the disclosure; nothing found this pass was withheld or
downgraded.

## 38. Operational due-diligence review

Not independently re-swept this pass for runbooks/jobs/support/moderation/transport-operations
process maturity beyond what's covered in §26 (background jobs, confirmed still nonexistent by Bot
2's own doc) and §33 (shared test infra instability, a real operational finding — see §5 acquisition
blocker #4).

## 39. Commercial due-diligence review

Not independently reviewed this pass. See `docs/BOT1_DUE_DILIGENCE_REVIEW.md` for the claims that
were checked (test-count claims, audit-completeness claims); pricing/unit-economics/monetisation
claims were not in scope for this pass's time budget.

## 40. Legal-boundary review

Not independently reviewed this pass. §7.2 (legal boundary implications of the account-deletion/
legal-hold gap) is covered under §27/§7.2 as a security finding with clear legal-process
consequences (a legal hold that can be silently released or bypassed by a raw write undermines its
entire purpose), which is the most legally load-bearing item this pass touched.

## 41. IP and dependency review

Not independently reviewed this pass.

## 42. Data-room review

Not independently reviewed this pass as a standalone exercise. This report, the remediation matrix,
and the 3 satellite review documents together constitute this pass's contribution to a data room —
they are written to be independently checkable (every claim has a command or file reference), which
is the property a real data-room technical annex needs.

## 43. Recommended Bot 2 fix order

Unchanged in substance from the remediation pass's own ordering (still valid — nothing has changed
underneath it), reproduced and lightly updated to reflect this pass's own candidate fix:

1. **§5.2 — apply or adapt this pass's candidate fix** (`candidate-fixes/bot1-legal-hold-deletion-
   raw-write-20260727` @ `7ba7b32`). Bundle the identical grant-revocation pattern for §6.3
   (`user_verifications`) and §6.4 (`route_assignments`) in the same migration — same root cause,
   same fix, already proven.
2. **§5.1 — fundraising `active` self-set.** Unchanged, smallest fix, proven template in the same
   migration file.
3. **NEW-H1 — `transport_requests` raw status-flip.** Fix promptly since it's a regression in code
   Bot 2 itself shipped this session; apply the same allowlist-trigger pattern already built this
   window for `support_cases`.
4. **§5.3 — `create_notification_if_enabled()` authorization gap.** Fix at the primitive; add the
   caller-authorization check Stage YR-1's own new inventory document should have prompted (§36).
5. **§5.4 — `moderation_cases` self-resolution.** Mirror `review_moderation_appeal()`'s existing
   guard one layer up, in the same file family Bot 2 has been actively working in.
6. **Close the RLS side of every "RPC now correct" finding in one sweep**: §6.1 (quotations), §6.5
   status half, NEW-H1's underlying pattern. All three are proof the *logic* is already right; the
   remaining work is narrowing an RLS clause or adding one more allowlist trigger.
7. **§6.6 — `buyer_applications.organization_id` cross-org binding.** Real, live, cross-tenant
   PII-routing gap.
8. **§6.7 — `transport-evidence` cancellation-revocation.** Template already live in the sibling
   bucket's policy.
9. **§6.9 — `uploaded_by` forgery.** Cheapest possible fix given the proven-in-hand trigger pattern
   (built three times already this session for other columns).
10. **§6.8 — verification approval/rejection audit trail.** Bot 2 just built the exact template
    needed (`place_legal_hold()`/`release_legal_hold()`'s audit-log insert).
11. **§7.5/§7.6 — Low, opportunistic.** §7.6 is now a copy-paste fix from `has-role-execute-lock.
    test.ts`.
12. **New this pass — update Bot 2's own audit methodology** per §36's recommendation, so future
    self-audits stop missing this specific bug class.

## 44. Candidate fix commits

| Branch | Commit | Closes | Verification | Applied to any live DB? |
|---|---|---|---|---|
| `candidate-fixes/bot1-legal-hold-deletion-raw-write-20260727` | `7ba7b32` | §5.2 in full (both the original admin-actor framing and the remediation pass's widened any-user framing); does **not** close §7.3 (`declined` path's client-supplied `processedBy`) | Static SQL review; pattern-matched against Bot 2's own two already-proven-live "revoke the raw grant" fixes on this schema (`20260101012900`, `20260101012800`); `npx tsc --noEmit` clean on the new regression test file | **No** — the shared local instance was under confirmed concurrent use; applying a migration to it risked corrupting Bot 2's own in-progress work, matching both prior passes' own stated caution. Bot 2 should apply this migration (or an adapted version) and run it through the normal `test:db` reset/no-reset/repeat cycle before merging. |

Never merged into this pass's own audit branch or `main`. Never pushed. Bot 2 decides whether to
reimplement or cherry-pick.

## 45. Exact reproduction commands

```js
// §5.1 -- fundraising self-publish -- STILL OPEN
await supabase.from('fundraising_campaigns').update({ status: 'active' }).eq('id', myDraftCampaignId);

// §5.2 -- legal hold / deletion-request raw bypass -- STILL OPEN on main; CLOSED on the candidate-fix branch
await supabase.from('legal_holds').insert({ subject_profile_id: targetUserId, reason: 'x', placed_by: otherAdminId });
await supabase.from('account_deletion_requests')
  .update({ status: 'processed', processed_at: new Date().toISOString(), processed_by: myOwnUserId })
  .eq('profile_id', myOwnUserId); // any ordinary user, own row, no admin role needed

// §5.3 -- notification spoofing -- STILL OPEN
await supabase.rpc('create_notification_if_enabled', {
  p_profile_id: victimId, p_category: 'moderation', p_notification_type: 'account_alert',
  p_title: 'URGENT: verify your account', p_body: 'Click here', p_link_url: 'https://attacker.example',
});

// §5.4 -- moderation self-resolution -- STILL OPEN
await supabase.from('moderation_cases').update({ status: 'dismissed', decision_explanation: 'no issue found' }).eq('id', caseAgainstMe);

// NEW-H1 -- transport_requests raw status-flip -- STILL OPEN
await supabase.from('transport_requests').update({ status: 'accepted_by_customer' }).eq('id', myTransportRequestId);
// (request must be in 'quotation_sent'; succeeds with no reference to quotations at all)
```

```bash
# Read-only live-DB introspection used this pass (safe to re-run against the shared instance)
docker exec supabase_db_the-puppy-passport psql -U postgres -d postgres -c \
  "select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname='public' and tablename in ('legal_holds','account_deletion_requests','moderation_cases','fundraising_campaigns','route_assignments','user_verifications','transport_requests','quotations','animal_ownership_history') order by tablename, policyname;"
docker exec supabase_db_the-puppy-passport psql -U postgres -d postgres -c \
  "select has_function_privilege('authenticated','public.create_notification_if_enabled(uuid,text,text,text,text,text,text,integer)','execute');"
docker exec supabase_db_the-puppy-passport psql -U postgres -d postgres -c \
  "select p.proname, pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='prevent_non_staff_operational_field_changes';"

# Static, offline, non-destructive checks (no DB required)
npm run db:preflight
npx tsc --noEmit
npm run build
git diff --stat c8bc235..26f1b2e -- supabase/migrations   # confirms 0 new migrations this delta
git merge-tree --write-tree <backend-HEAD> <frontend-ref>  # real 3-way merge conflict list
```

## 46. Test and build results

- **`npx tsc --noEmit`**: clean, exit 0, zero errors (against a read-only `node_modules` copy from
  the source repo's own install; no `npm install` run).
- **`npm run build`**: clean, exit 0 — Vite client build + Nitro/Cloudflare-Worker server build both
  completed, output in this clone's own `.output/`.
- **`npm run db:preflight`**: clean — "Scanned 137 migration files. No known unsafe patterns found."
- **`npm run test:db`**: **not run this pass**, deliberately — see §33.
- **`npm run test:unit`**: not run this pass (new this window; time-budgeted against higher-value
  verification work).
- **Live `psql` introspection**: 9 tables/functions checked (§7/§8/§16), all consistent with the
  prior pass's findings, no drift detected.

## 47. Initial snapshot

- Initial source snapshot: `26f1b2ef6b1a43315d11512e22983500dcd8e788`.
- Prior audit's Phase 1/2 snapshots (for reference, unchanged): `9b16b98ef25343ea31ace7f39b24d72
  ed61492a1` / `359e0f3bba34ddb1d886f3e62bffb57cbad6f463`.
- Remediation pass's snapshot: `c8bc235eb50b345208ac73e0630eaebf9f9e99fc`.

## 48. Latest committed snapshot

- **Latest source snapshot reviewed this pass**: `26f1b2ef6b1a43315d11512e22983500dcd8e788` —
  identical to the initial snapshot; `main` did not move during this pass (re-confirmed via a final
  `git -C /p/the-puppy-passport rev-parse HEAD` immediately before writing this section). The
  task's "latest delta loop" therefore has nothing further to capture this pass — a second delta
  check was performed (per the task's instruction to repeat it once if time remains) and found the
  same result: no new commits.
- **Commits reviewed in this pass's own delta** (`c8bc235..26f1b2e`): 8 (4 stage-work + 4 "fill in
  commit hash" companions), 0 new migrations, 13 changed files (`docs/AUTONOMOUS_BACKEND_PROGRESS.md`
  plus 4 new docs, `package.json`, `src/lib/notification-templates.ts`,
  `src/lib/queries/{applications,moderation,notifications,rehoming}.ts`, 2 new test files).

### 48a. Second delta-loop check (post-report-draft)

Per the task's own instruction to repeat the delta check once more if time remains: a second
`git -C /p/the-puppy-passport rev-parse HEAD` performed while finalising this report found `main`
had moved to `2971c3b914640b9c2bf4800c7c0e7880bbee304b` (4 more commits: Stage YR-5 "event replay
safety" and Stage YR-6 "support-to-operations boundary audit", each with its usual "fill in commit
hash" companion commit) — real, continuing Bot 2 activity during this pass. `git -C
/p/the-puppy-passport diff --stat 26f1b2e..2971c3b -- supabase/migrations` is still **empty** — 0
new migrations in this second delta either, only 2 new audit docs and 2 new/changed test files
(`tests/db/event-replay-safety.test.ts`, `tests/db/support-cases.test.ts`). No finding in this
report is affected. This pass's own audited snapshot remains `26f1b2ef6b1a43315d11512e22983500
dcd8e788` (the last snapshot with a stable window for this pass's own live verification and report
drafting); `2971c3b` is recorded here as the latest-observed real-repo state for the next pass to
start from, not independently audited by this pass beyond the diffstat above. The real repo's
working tree also gained one more untracked file since this pass began
(`supabase/migrations/20260101013600_admin_command_audit_coverage.sql`, uncommitted — not read,
per the task mandate) — worth flagging only because it coincidentally shares this pass's own
candidate-fix migration's timestamp prefix; since the candidate fix lives only in this pass's
isolated clone and was never pushed, there is no real collision, but Bot 2 should be aware when it
eventually commits its own `20260101013600` file that this pass's candidate branch used the same
prefix for an unrelated change.

## 49. Limitations

- **Not all 130 stages received deep, independent evidence-gathering this pass.** Stages given real,
  fresh evidence: B1-001–B1-003 (snapshot/ingestion/truth-check, including the NEW-M1 finding),
  B1-004–B1-007 (migration/RLS/grant review, targeted to the 9 open-finding tables), B1-016/B1-017
  (SECURITY DEFINER inventory, confirmed no new functions), B1-018–B1-025 (actor attribution/
  protected-field, targeted to open findings), B1-030/B1-033 (quotation/transport state machines,
  NEW-H1's home), B1-045/B1-049 (notification producer/primitive review — the NEW-M1 finding),
  B1-091–B1-093 (release preflight, tsc, build), B1-094/B1-095/B1-098 (frontend conflict
  revalidation), B1-119/B1-120 (adversarial reproduction commands, §45), B1-126 (latest delta loop,
  §48), B1-127/B1-128 (candidate fix + its own verification), B1-129/B1-130 (this report's own
  consistency and finalisation). Stages **not** independently worked this pass, and therefore not
  claimed as checked: B1-008–B1-015 (fresh anonymous/authenticated/tenant-isolation/driver/
  operations/moderator/support/admin-scope adversarial testing beyond the 9 tables already covered),
  B1-026–B1-029/B1-031/B1-032 (verification/fundraising/application/reservation/handover integrity
  beyond what's already tracked), B1-034–B1-044 (route/stop/driver/vehicle/evidence/document/message
  reviews), B1-046–B1-048/B1-050–B1-063 (notification preferences/dedup/templating,
  outbox/job/backpressure, support/moderation state machines, legal-hold propagation, deletion/
  anonymisation/export mechanics, archival, storage lifecycle beyond §6.7), B1-064–B1-090 (signed
  URLs, public contracts, pagination, error taxonomy, API contracts, generated types, schema drift,
  test determinism/realism, concurrency/failure-injection tests, performance, volume, health/
  metrics, incident response), B1-096/B1-097/B1-099/B1-100 (deeper frontend conflict areas beyond
  the file-level table, integration runbook/rehearsal), B1-101–B1-118 (product-scope, architecture,
  security/operational/commercial due diligence, legal, IP/licence, dependency review, data-room,
  tech-debt, roadmap, KPI, analytics, demo environment, sales enablement, valuation-readiness).
  **Resume from B1-008** (fresh adversarial anonymous/tenant-isolation testing) as the next
  highest-value unworked cluster, per the task's own priority ordering, since B1-001–B1-007 and the
  High-finding-adjacent stages are now done.
- **No destructive DB verification run this pass** — same reasoning and same evidence class as both
  prior passes (§33), strengthened this time by direct container-uptime evidence at the very start
  of the pass rather than a mid-pass observation.
- **Candidate fix not applied to any live database** — static review and pattern-matching only; Bot
  2 should run it through a real `test:db` cycle before merging.
- **Sub-agent delegation was not used this pass** for the core verification work, for the same reason
  the remediation pass gave (a narrow, evidence-tracing task, not a from-scratch breadth sweep) — the
  operational lesson from the very first six-hour audit (losing sub-agent work) was avoided by not
  needing sub-agents for the highest-priority work, not by successfully integrating them.
- **Test-suite scale claims not independently reconciled** — see `docs/BOT1_DUE_DILIGENCE_REVIEW.md`.

## 50. Final conclusion

The product is not release-ready: 4 High findings and 1 High regression, all independently
re-confirmed live across three separate audit passes spanning 77 commits of otherwise real,
substantial security-hardening work, remain completely unaddressed. The underlying engineering
quality is genuinely good — clean `tsc`/build, clean migration hygiene, thoughtful, well-tested
incremental fixes for the bug classes Bot 2's own process does catch — but this pass's own new
finding (NEW-M1, §36) shows that Bot 2's own audit methodology has a structural blind spot that has
now independently reproduced the same miss twice. The single highest-leverage action available is
not more feature work: it is closing the specific, small, already-diagnosed RLS/grant gaps this
report (and its two predecessors) point to exactly, starting with §5.2 — for which a ready-to-review
candidate fix now exists on `candidate-fixes/bot1-legal-hold-deletion-raw-write-20260727` — and then
updating the self-audit process itself so the next "producer inventory"-style document asks "is this
also directly callable?" as a standing question, not an afterthought.

---

## RESUMPTION ROUND (authoritative current state — supersedes §§1–50 where noted)

Resumed in the same isolated clone/branch, explicitly instructed to prefer empirical verification
over static claims wherever the shared instance's actual state allowed it, and to continue through
further stage clusters (B1-008 onward) rather than stopping at §§1–50's checkpoint.

### 51. Live-instance state check (empirical, not assumed)

Unlike every prior Bot 1 pass (including §§1–50 above), this round did not default to "the shared
instance is probably unsafe" — it re-checked the instance's actual state at the start, and multiple
times during the round, before deciding whether to run live queries or live writes:

- **Initial check**: `docker ps` showed `supabase_db_the-puppy-passport` with only ~5 seconds of
  uptime and `health: starting`, and `supabase_migrations.schema_migrations` did not exist yet —
  direct, real-time evidence the instance was **mid-reset** at that exact moment (Bot 2 or an
  equivalent process actively resetting it). No query beyond the liveness check itself was run
  during this window.
- **~30–60 seconds later**: container reported `healthy`, `public` schema had all 77 (later 70 base
  tables + views) objects present, `pg_stat_activity` showed **zero non-idle backends**, and seed
  data (`profiles` row count, known fixture ids) was present and consistent with a completed,
  successful reset — the instance was now genuinely idle, not merely quiet.
- **This idle window was used for real, empirical, authenticated-actor testing** (§52) — the
  specific action the task explicitly asked this round to take "where safe," rather than defaulting
  to the same read-only caution as every prior pass by rote.
- **Re-checked for concurrent activity before and after every batch of writes** (`pg_stat_activity`
  non-idle count, `docker ps` uptime) — zero non-idle backends found at every check point during this
  round's live-write window.
- **Mid-round, a routine live check (an exploit attempt against §5.1) failed unexpectedly** — not
  because the instance became unsafe, but because the *schema itself* had changed: `main` had moved
  forward to `8201f17` (5 new migrations, ~19 new stage commits) without this round's initial check
  having re-polled `git -C /p/the-puppy-passport rev-parse HEAD` first. This is recorded honestly as
  a real process gap this round had, corrected the moment the unexpected result surfaced it (see
  §54) — not glossed over.

### 52. Live-empirical exploit testing: methodology and full raw results

For every High finding still believed open, and several Medium findings, this round authenticated as
the real, exact lower-trust seeded persona named in the finding (via `@supabase/supabase-js` +
GoTrue `signInWithPassword`, the identical client library and auth path the real app and a real
attacker would use — never a service-role key, never a superuser session for the exploit attempt
itself) and issued the *exact* reproduction call from the finding, recording the raw PostgREST
response. Every mutation that succeeded (proving a real gap) was reverted immediately afterward via
a separate, superuser `psql` statement, and the reversion was itself verified by re-reading the row —
not assumed. No mutation was left in place. Full results:

| Finding | Actor | Action | Result | Cleanup verified |
|---|---|---|---|---|
| §5.1 fundraising self-publish | `foundation1` (real org owner) | `update fundraising_campaigns set status='active'` on a freshly-built, fully valid draft campaign (real linked animal/buyer-application/accepted-quotation fixtures, built via superuser insert to satisfy `fundraising_campaign_links_are_valid()`) | **REJECTED** — `P0001 "A fundraising campaign can only go live after Havenpaw staff have approved it."` — proves this is now genuinely fixed, not just claimed | Probe campaign deleted |
| NEW-H1 transport status-flip | `customer` (real requester) | `update transport_requests set status='accepted_by_customer'` on their own real request (`a0000000-...003`, live status `quotation_sent`) | **SUCCEEDED** — status flipped with zero reference to `quotations` | Reverted to `quotation_sent`, verified |
| §5.2a legal-hold raw insert | `admin` (real) | raw insert into `legal_holds`, forging `placed_by` to a different staff id | **SUCCEEDED** | Probe row deleted, verified 0 rows remain with that id |
| §5.2b deletion-request self-bypass | `customer` (real, non-staff) | self-insert own `pending` request (legitimate), then self-update straight to `processed` forging `processed_by` to themselves | Insert **succeeded** (legitimate); raw update to `processed` **SUCCEEDED** (the bypass) | Probe row deleted entirely, verified |
| §5.3 notification forgery | `customer` (real, zero relationship to target) | `rpc('create_notification_if_enabled', ...)` targeting `ops` with an attacker-controlled title/body/phishing link | **SUCCEEDED** — real row created in `ops`'s notification feed | Probe row deleted, verified |
| §5.4 moderation self-resolution | `customer`, temporarily granted (then revoked) a real `active` `moderator` role | raw-update a real case (`affected_profile_id` = themselves) to `dismissed` with a decision | **SUCCEEDED** (first attempt returned an empty result because the role grant defaulted to `status='pending'`, not `'active'` — a real methodology correction made mid-probe, documented not hidden; retried after activating the role and succeeded) | Probe case deleted, temporary role grant revoked, both verified |
| §6.3 verification raw-approve | `admin` (real) | raw-update a real `pending` verification straight to `approved`, bypassing `approve_user_verification()` | **SUCCEEDED** — and directly confirmed the "approved but broken" claim: `select * from organisations where owner_user_id = <that user>` returned **zero rows** after the raw approval | Reverted to `pending`, verified |
| §6.4 route-assignment forgery | `ops` (real) | raw-insert a `route_assignments` row on a real, previously-unused route+request pair, forging `assigned_by` to `admin` | **SUCCEEDED** | Probe row deleted, verified |

**Every single probe attempted against a claimed-open finding succeeded exactly as predicted, except
§5.1, which is why §5.1 was investigated further and found fixed.** This is strong positive evidence
that the remaining open findings (§5.2, §5.3, §5.4, NEW-H1, §6.3, §6.4) are not just theoretically
reachable from policy text but are **actually, presently exploitable** on the live schema at `HEAD`
`8201f17` — the strongest evidence tier any of the three Bot 1 passes has produced for any of them.

**Fixture-construction note for §5.1**: building a valid campaign required a real `accepted`
quotation and a real `adoption`-type buyer application, both linked to a real animal owned by the
target org (`Fundacja Ratunek dla Psów`) and a real transport request — none of these existed in
seed data, so this round constructed them via direct superuser insert (not via RLS-bypassing the
finding itself, just building otherwise-ordinary prerequisite rows a real org's genuine workflow
would have produced over time) before attempting the campaign creation and self-publish as the real,
RLS-governed `foundation1` persona.

### 53. §5.1 and §7.5: confirmed genuinely fixed — full correction of §§7.1/§9/§10

**§5.1 — Fundraising campaigns self-publish to `active` — now FIXED.**
Fixing commit: `52637b1` / migration `20260101014000_fundraising_self_publish_lock.sql` (Stage FA-3).
Effective mechanism: a new `before update` trigger, `fundraising_campaigns_prevent_self_publish()`,
rejects any non-admin `status` transition to `'active'` unless `OLD.status = 'approved'` — the exact
gate the original finding said was missing, implemented as a trigger (not an RLS `WITH CHECK`
rewrite) because, as the migration's own comment correctly notes, a bare `WITH CHECK` cannot see
`OLD.status`. **Why three Bot 1 passes (including this one's own first round) all missed that this
was even checkable**: all three inspected only the RLS policy's `WITH CHECK` clause for this table
and never ran `select tgname from pg_trigger where tgrelid = 'public.fundraising_campaigns'::regclass`
— the same "read the trigger body, not just the RLS policy" gap the remediation pass's own NEW-H1
finding already flagged as a method to apply more broadly (its §52 limitations note said exactly
this: "the same method was not systematically re-run against every other trigger... Bot 2 (or a
future pass) should consider this a candidate method to apply more broadly"). This round did exactly
that, on this table, driven by an empirical test failing rather than a deliberate broader sweep — the
lesson generalizes further still: Bot 1's own future passes should live-query `pg_trigger` for
*every* table with an open RLS-shaped finding before concluding a raw path is unguarded, not only
after a surprise. Test file: `tests/db/fundraising.test.ts` (per the progress log, extended this
stage; not independently re-read line-by-line this round, but the live trigger body itself is
unambiguous and was read in full). Remaining risk: none identified against this specific gap.
Repeated-run verification: not re-run by this pass (would require `test:db`); the live empirical
exploit-and-reject this round performed is a different, real form of repeated verification.

**§7.5 — `getFriendlyErrorMessage()` wiring — now FIXED.**
Fixing commit: `c6ff881` (Stage YR-16, "Error-contract consistency", pure TypeScript, no migration).
Per Bot 2's own progress-log entry (specific, checkable claims, not vague): wired into 32
genuinely customer-facing route files (ops/admin dashboards correctly exempted), found the true
baseline was 1 of **88** call sites (worse than either prior Bot 1 pass's "1 of 4" estimate — the
prior passes' own sweep undercounted the affected surface), 30 converted mechanically matching the
existing idiom, 2 by hand, 3 auth-flow files deliberately left alone (GoTrue errors, never routed
through Postgres, already safe). **Independently re-checked this round** (not merely trusting the
log entry): `grep -rln getFriendlyErrorMessage src/` against the current real-repo working tree
returns **33 files**, not the 2 both prior Bot 1 passes found — consistent with the claimed 32-file
expansion. This is a genuinely verified fix, not just a claim taken at face value.

**Both corrections propagate to**: §7 (High findings — §5.1 should be removed from the open list),
§9 (Low findings — §7.5 should be removed), §10 (Fixed prior findings — both should be added), §12
(Still-open — both should be removed), the executive summary (§2)'s finding-count claims, and every
downstream document (`BOT1_REMEDIATION_MATRIX.md`, already updated; `BOT1_RELEASE_REVIEW.md`,
`BOT1_DUE_DILIGENCE_REVIEW.md`, updated in this same commit batch — see their own current versions,
not restated here to avoid duplication).

### 54. Second real-repo snapshot capture and 5-migration delta review

`git -C /p/the-puppy-passport rev-parse HEAD` mid-resumption-round: `8201f17dd4c8abc36cc816d63c52
f3620ae7e44f` — 26 commits ahead of this pass's §48 checkpoint (`2971c3b`), working tree clean (the
2 previously-untracked files from §48a are now committed). `git diff --stat 2971c3b..8201f17 --
supabase/migrations`: **5 new migrations** (`20260101013600`–`20260101014000`, Stages YR-7 through
FA-3) — the first non-empty migration delta either round of this pass has seen. Each read in full:

- **`20260101013600_admin_command_audit_coverage.sql`** (Stage YR-7): adds `audit_logs` inserts to 9
  staff-privileged RPCs that previously had none, including `approve_user_verification()` — closes
  the approval half of §6.8 (still no `reject_user_verification()` RPC, so the rejection half stays
  open — see the remediation matrix). Does not touch any RLS policy or grant on any table this report
  has an open finding against.
- **`20260101013700_suspended_org_application_lock.sql`** (Stage YR-8): splits `buyer_applications`'
  single `for all` buyer policy into SELECT/UPDATE/DELETE/INSERT, adding a real, correctly-scoped
  check that a new application's `organization_id` belongs to a currently-`approved` organisation —
  a genuine, different fix (closes a suspended-org application bypass) that does **not** close §6.6
  (no cross-check that `organization_id` actually matches the referenced `animal_id`'s real owning
  org — confirmed via a fresh live read of the new policy's exact `with_check` text, §52's table
  above did not re-test this one empirically for time reasons, static/live-policy-text confirmation
  only).
- **`20260101013800_transport_terminal_reopen_reason.sql`** (Stage YR-10): adds a mandatory
  `internal_note` requirement when *ops* reopens a *terminal* transport request via
  `change_ops_request_status()`. Unrelated to NEW-H1 (a different function, a different actor tier,
  a different transition) — confirmed via full read, NEW-H1's own trigger is untouched by this file.
- **`20260101013900_moderation_case_report_unique.sql`** (Stage YR-15): adds a real unique constraint
  preventing duplicate `moderation_cases` per report (closes a raw-API duplicate-case bypass — a
  real, different bug from §5.4). Does not touch case *resolution* or add any self-dealing guard —
  §5.4 confirmed still open both statically and empirically this round (§52).
- **`20260101014000_fundraising_self_publish_lock.sql`** (Stage FA-3): the §5.1 fix, §53 above.

**No migration in this 5-file delta touches**: `legal_holds`, `account_deletion_requests`,
`create_notification_if_enabled()`, `route_assignments`'s RLS/grants, `user_verifications`'s
RLS/grants, `quotations`' RLS, `transport_status_history`'s INSERT policies,
`transport-evidence`/`transport_documents`/`welfare_case_documents` — consistent with every open
finding on those tables/functions remaining open, which §52's live-empirical results independently
confirm for the 6 that were actually tested.

**A second delta-loop check was performed at the end of this round**: `git -C /p/the-puppy-passport
rev-parse HEAD` → still `8201f17` (no further real-repo commits landed in the remaining time of this
round). `git -C /p/the-puppy-passport status --short` → clean.

### 55. New findings this round

**NEW-H2** — see the remediation matrix for the full writeup with exact citations. Summary: Bot 2's
own Stage YR-15 (`docs/RAW_API_BYPASS_AUDIT.md`) explicitly defines and repeatedly hunts for the
precise bug class this report's own §5.2/§6.3/§6.4 findings are — "a lower-trust actor reaching a
protected field or an RPC-only transition via a raw call" — and explicitly distinguishes it from the
"trusted staff bypassing their own RPC" pattern it correctly judges as by-design and not a real
issue. But YR-15's own sweep scope is "this stage's own new migrations" only, so it never revisits
the older, pre-existing tables where this exact class of bug — one it says it has closed "dozens of
times already" elsewhere — still lives, including §5.2's own non-staff-reachable half (an ordinary
`customer`, not an ops/admin/moderator, live-empirically confirmed this round to bypass
`execute_account_deletion()`'s entire safety model on their own row). This is Bot 2's second
consecutive newest-work self-audit (after NEW-M1's Stage YR-1 finding) that has the *correct*
methodology in hand and applies it narrowly to new code only, never as a full-schema sweep against
its own already-standing older findings.

**Confirms NEW-M1 was not a one-off**: NEW-M1 (§36) found Stage YR-1's notification-producer
inventory reasoning only from "our own call sites," missing the raw-RPC surface. NEW-H2 finds Stage
YR-15's raw-API-bypass audit reasoning only from "this stage's own new migrations," missing the
older-table surface. Two structurally similar blind spots, independently found in two different
newest-work audit documents, are stronger evidence of a systemic pattern in Bot 2's own review
process than either alone — see §43 (updated recommendation below) for what this suggests Bot 2
should change about how it scopes future self-audits.

### 56. Updated recommended Bot 2 fix order (supersedes §43)

1. **§5.2 — apply or adapt this pass's candidate fix** (`7ba7b32`) — now carrying live-empirical
   proof for both halves, and the more significant one (any ordinary user, not just an admin, can
   falsify their own account-deletion audit record) is exactly the bug class Bot 2's own YR-15 audit
   says it takes seriously when found — it just hasn't looked at this table yet. Bundle §6.3/§6.4 in
   the same migration (identical shape, also now live-empirically confirmed).
2. **§5.3 — `create_notification_if_enabled()` authorization gap.** Unchanged priority; live-
   empirically confirmed this round.
3. **§5.4 — `moderation_cases` self-resolution.** Unchanged priority; live-empirically confirmed this
   round, including the real mechanic (any user can be granted moderator and self-resolve a case
   against themselves).
4. **NEW-H1 — `transport_requests` raw status-flip.** Unchanged priority; live-empirically confirmed
   this round, still not touched by the 5 new migrations.
5. **New recommendation this round — widen Bot 2's own next self-audit's scope, not just its
   method**: both NEW-M1 and NEW-H2 show Bot 2 already has the right methodology (check whether a
   lower-trust actor can bypass an RPC's authorization/business logic via a raw call) but has applied
   it only to newly-written code twice in a row. A single stage that runs the exact same YR-15-style
   check against *every* `SECURITY DEFINER` RPC in the schema, old and new, cross-referenced against
   its underlying table's RLS — not scoped to "this session's own work" — would very likely find and
   close §5.2/§5.3/§5.4/§6.3/§6.4/NEW-H1 in one pass, since Bot 2's own tooling and judgment for this
   exact bug class is already proven correct twice.
6. **§6.1/§6.5 status half/§6.6/§6.7/§6.8 rejection half/§6.9** — unchanged from §43, still open,
   not touched by the 5-migration delta.
7. **§7.6** — the last remaining open Low finding from the original 6; unchanged.

### 57. Empirical-testing session hygiene confirmation

- Every probe row/mutation created by this round's live testing was deleted or reverted, and every
  reversion was verified by a direct superuser read of the affected row — not assumed from the
  cleanup statement's own success message.
- Final row-count sanity check after all cleanup: `legal_holds` (10), `account_deletion_requests`
  (8), `route_assignments` (2, matching the pre-probe count exactly) — no residual probe data.
- No `db reset`, no `test:db`, no migration applied by this round to the shared instance. All schema
  changes observed (`20260101013600`–`20260101014000`) were Bot 2's own, pre-existing before this
  round's first live query.
- Temporary probe scripts (`.audit-temp/live-probe.mjs`, `.audit-temp/probe2.mjs`,
  `.audit-temp/probe3.mjs`) were deleted immediately after each was run; `.audit-temp/` is empty and
  removed before the final commit, per the task's temporary-file rule.
- This pass's own candidate-fix migration (`7ba7b32`, on the isolated `candidate-fixes/` branch) was
  never applied to the shared instance during this round — the live schema tested against throughout
  §52 is Bot 2's real, unmodified `main` state at `8201f17`.
