# Bot 1 — Latest High Finding Register

Authoritative, single-page register for the 5 High findings plus the previously-fixed findings that
must be regression-checked going forward. Supersedes scattered per-report detail for quick
reference; full evidence trail remains in `docs/BOT1_OVERNIGHT_FINALISATION_AUDIT.md` §12 and the
prior lineage reports cited throughout.

**STATUS AS OF LATEST REVIEW: all 5 High findings FIXED — statically reviewed in full (code +
regression tests) AND independently, empirically re-verified this pass via non-destructive
rollback-transaction attack reproduction directly against the shared local Supabase instance (real
JWT-claims impersonation of real lower-trust seeded actors, `BEGIN ... ROLLBACK`, zero residual
rows, confirmed by a post-check). This is a genuinely different verification technique from Bot 2's
own test-suite claims — not a re-run of Bot 2's tests, an independent reproduction.** Latest
committed `main` HEAD reviewed: `92e8126cb6a4a2ca4bf5a96dad7226195d2d05ac`. See the Delta
Verification Log at the bottom of this file for the full commit-by-commit trail (Delta 1:
`ac612690`→`e8cf7073`, unrelated fix; Delta 2: `e8cf7073`→`92e8126c`, all 5 High fixes landed).

---

## DV-1 / NEW-H1 — `transport_requests.status` raw-flip to `accepted_by_customer`

- **Severity**: High. **Confidence**: High (live-confirmed, two independent methods: static
  migration-text reading across 2 prior passes, live trigger-body + RLS read this pass).
- **Latest main HEAD reviewed**: `ac612690`.
- **Effective mechanism**: table `public.transport_requests`; RLS policy `requesters update their
  own transport requests` (`UPDATE`, `roles={authenticated}`, `qual`/`with_check =
  requester_profile_id = auth.uid()`); trigger `prevent_non_staff_operational_field_changes`
  (function `public.prevent_non_staff_operational_field_changes()`, `SECURITY DEFINER`) — for a
  non-staff, non-driver actor its status guard explicitly exempts
  `(old.status = 'quotation_sent' and new.status = 'accepted_by_customer')` from the block. Intended
  sole path: RPC `respond_to_quotation()` (migration `20260101013400_quotation_dispatch_atomic_rpcs.sql`).
- **Real actor**: any authenticated user who is `requester_profile_id` on their own row (a normal
  customer, zero elevated privilege).
- **Exact reproduction** (raw Data API, no RPC): `PATCH
  /rest/v1/transport_requests?id=eq.<own_row_id>` with body `{"status":"accepted_by_customer"}`,
  bearer token = the requester's own session, where the row's current `status='quotation_sent'`.
  RLS permits (own row); trigger permits (explicit exemption clause). Succeeds without ever calling
  `respond_to_quotation()`.
- **Current status**: **FIXED — empirically verified.** Fixing commit `66383af`, migration
  `20260101014500_quotation_acceptance_raw_forge_lock.sql`. The trigger now requires
  `exists(select 1 from quotations q where q.transport_request_id = new.id and q.status='accepted'
  and (q.expiry_date is null or q.expiry_date >= current_date))` before allowing the
  `quotation_sent → accepted_by_customer` transition for a non-staff caller. **Verified the
  underlying state can't itself be forged**: live-read `quotations`' own `requesters accept or
  reject their own quotation` UPDATE policy `WITH CHECK` independently blocks setting
  `status='accepted'` on an expired quotation. **Empirical reproduction this pass** (non-destructive,
  rollback-wrapped, real seeded row `a0000000-0000-0000-0000-000000000003`, real expired quotation
  `420018fe...` with `expiry_date=2026-07-27`, real customer actor `10000000...0001` via JWT-claims
  impersonation): raw `UPDATE transport_requests SET status='accepted_by_customer'` →
  **denied, `sqlstate=P0001`, `"Only operations staff or the assigned driver can change a transport
  request's status to accepted_by_customer"`**. Transaction rolled back, zero residual state.
  Static test `tests/db/quotation-dispatch-atomic-rpcs.test.ts` ("transport_requests.status: a raw
  update cannot forge accepted_by_customer") read in full: covers no-accepted-quotation rejection,
  a *second* attempt to first forge the quotation itself (also rejected by RLS, proving the two
  layers are consistent), and confirms the legitimate `respond_to_quotation()` RPC path still works
  end-to-end. **Minor test-quality note**: both the migration's own test and this pass's own
  reproduction assert on the exception/error being non-null; the *test* asserts generic truthiness
  (`assert.ok(attempt.error)`) rather than a specific `error.code`, though this pass's own direct
  psql reproduction did capture and confirm the exact `P0001` SQLSTATE independently.
- **Candidate fix status**: N/A — Bot 2 deliberately reimplemented from scratch rather than
  cherry-picking any Bot 1 candidate branch (none existed for this specific finding anyway).
- **Remaining risk**: none identified. Real actor, real precondition, real denial with correct
  SQLSTATE, legitimate path unaffected, underlying forgeable-state concern independently checked and
  found already safe.
- **Regression-test checklist coverage** (original ask, now checked against the landed fix):
  (a) raw forge blocked ✓ empirically confirmed; (b) expired quotation cannot be accepted, raw or
  RPC ✓ (RLS `WITH CHECK` blocks raw; `respond_to_quotation()`'s own pre-existing expiry check
  covered by a separate, pre-existing test); (c) missing quotation cannot be accepted ✓ (the
  `exists()` check fails with no accepted row at all, same code path); (d)/(e)/(f) terminal-state
  reopen, concurrency race, and payload-smuggling — **not independently re-tested this pass**, no
  new test targets these specifically and this pass did not construct one (lower-priority, not
  security-boundary-critical given the primary bypass is closed); (g) canonical RPC path ✓ confirmed
  by both the static test and this pass's own reasoning about the trigger's exemption clause still
  matching what `respond_to_quotation()` produces; (h) RPC idempotency — pre-existing, not
  re-verified this pass.
- **Release-blocker status**: Was yes, **now cleared** pending the empirical evidence above.
- **Integration-blocker status**: No known frontend conflict tied to this specific finding.

---

## DV-2 / §5.3 — `create_notification_if_enabled()` arbitrary-recipient phishing

- **Severity**: High. **Confidence**: High (live-confirmed via `pg_proc.proacl`/`\df+`).
- **Latest main HEAD reviewed**: `ac612690`.
- **Effective mechanism**: function `public.create_notification_if_enabled(p_profile_id uuid,
  p_category text, p_notification_type text, p_title text, p_body text DEFAULT NULL, p_link_url
  text DEFAULT NULL, p_dedup_key text DEFAULT NULL, p_template_version integer DEFAULT NULL)` —
  `SECURITY DEFINER` (`prosecdef=t`), owned by `postgres`, `proacl = {postgres=X/postgres,
  authenticated=X/postgres}` — **directly EXECUTE-granted to `authenticated`**, no wrapping
  authorization RPC restricting `p_profile_id` to self or a legitimate producer relationship.
- **Real actor**: any authenticated user, zero elevated privilege.
- **Exact reproduction**: `POST /rest/v1/rpc/create_notification_if_enabled` with
  `{"p_profile_id": "<any other user's UUID>", "p_category": "...", "p_notification_type": "...",
  "p_title": "Your account will be suspended", "p_body": "Click here: https://attacker.example",
  "p_link_url": "https://attacker.example"}`, bearer token = attacker's own session. Succeeds,
  creates a notification that appears to the victim as coming from Havenpaw.
- **Current status**: **FIXED — empirically verified.** Fixing commit `b05d527`, migration
  `20260101014600_notification_producer_authorization_lock.sql`. The function body (live-read via
  `\sf`, matches the migration exactly) now requires
  `auth.uid() = p_profile_id OR is_moderator() OR exists(a real buyer_applications row for
  p_profile_id at an org owned by the caller)` before inserting, mirroring the table's own two
  pre-existing legitimate raw-INSERT RLS policies exactly (verified those policies' live
  `with_check` clauses match this new function-level check). `is_moderator()` independently
  confirmed (live `\sf`) to be `has_role('moderator') OR is_admin()` — covers admin as intended.
  **Empirical reproduction this pass** (rollback-wrapped, unrelated real actor
  `10000000...0006` (foundation_member, no relationship to the target), calling with a realistic
  phishing payload — title "Your account will be suspended", link `https://evil.example.com`):
  **denied, `sqlstate=P0001`, `"you are not authorised to notify this user"`**. Static test
  `tests/db/notification-preferences.test.ts` ("create_notification_if_enabled: authorization
  boundary") read in full: covers unrelated-caller denial, self-notify success, a **real dual-role**
  moderator (role granted then revoked within the test) successfully notifying an unrelated user,
  and an org owner successfully notifying a real applicant but rejected for an unrelated user —
  directly matching this finding's DV-2 checklist shape. Verified only one real call site exists in
  `src/` (`src/lib/queries/notifications.ts`), so no legitimate flow was missed by the new check.
- **Content-governance vs. security-boundary distinction (flagged per the task's own instruction)**:
  the fix closes the **arbitrary-recipient** security boundary completely. It does **not** restrict
  **content** (title/body/link_url) for the two broader legitimate channels — a moderator or an org
  owner notifying a real applicant can still send arbitrary title/body/link text to that
  authorized recipient. This exactly mirrors the pre-existing, independently-designed RLS policies
  for raw inserts on the same table ("moderators and admins create notifications for any user" has
  no content restriction either) — **not a new gap introduced by this fix**, a pre-existing,
  lower-severity content-governance question that sits outside the scope of the arbitrary-recipient
  security finding this migration closes. Recorded as a residual, non-blocking observation, not a
  reopened finding.
- **Candidate fix status**: N/A — no Bot 1 candidate branch existed for this finding; Bot 2
  implemented independently.
- **Release-blocker status**: Was yes, **now cleared**.
- **Integration-blocker status**: No known frontend conflict; the one real call site's signature is
  unchanged.
- **Remaining risk**: none blocking. See the content-governance note above as a possible future
  hardening item, not a defect.

---

## DV-3 / §5.2 — `legal_holds`/`account_deletion_requests` raw-write bypass

- **Severity**: High. **Confidence**: High (live-confirmed via `pg_policies`).
- **Latest main HEAD reviewed**: `ac612690`.
- **Effective mechanism**: table `public.account_deletion_requests`; RLS policy `users manage their
  own deletion request` (`ALL`, `roles={authenticated}`, `qual`/`with_check = profile_id =
  auth.uid()`) — no column-level restriction, and `authenticated` holds raw `INSERT`/`UPDATE`/
  `DELETE` grants on the table. Intended sole path for state transitions: RPC
  `execute_account_deletion()` (anonymisation + deletion-blocker-graph checks). `public.legal_holds`
  itself has only an admin-only policy (`admins manage legal holds`, `is_admin()`) — the raw-write
  surface is specifically the self-service `account_deletion_requests` policy's lack of column
  restriction, which can be used to forge a `status`/approval-adjacent column directly.
- **Real actor**: any authenticated user, on their own `account_deletion_requests` row.
- **Exact reproduction**: `PATCH /rest/v1/account_deletion_requests?id=eq.<own_row_id>` with a body
  setting whatever status/approval column the schema exposes (e.g. forcing straight to a
  "processed"-equivalent state), bearer token = the user's own session. RLS's `ALL` self-policy
  permits it; no trigger blocks it.
- **Current status**: **FIXED — empirically verified.** Fixing commit `6cff166`, migration
  `20260101014700_account_deletion_request_field_lock.sql`. **Different implementation shape than
  candidate fix `7ba7b32`** — Bot 2 did not narrow the RLS policy; instead added two triggers:
  `prevent_non_admin_deletion_request_field_changes` (blocks non-admin changes to `status`/
  `processed_at`/`processed_by`, `P0001`) and `stamp_deletion_request_processed_by` (unconditionally
  server-stamps `processed_by = auth.uid()`/`processed_at = now()` on any transition into
  `processed`/`declined`, **even for the legitimate admin path** — closes actor-forgery for admins
  too, not just non-admins). Both triggers confirmed live-attached to `account_deletion_requests`
  (`\d` + `pg_trigger`). **`legal_holds` cross-checked as required by this task's own checklist**:
  still exactly one policy, `admins manage legal holds` (`ALL`, `is_admin()`) — no self-service
  policy at all, confirmed live via `pg_policies`, unchanged by this delta. Both halves of §5.2 are
  therefore safe. **Empirical reproduction this pass** (rollback-wrapped; inserted a real pending
  row for real actor `10000000...0001`, then attempted `UPDATE ... SET status='processed',
  processed_by='<admin id>', processed_at=now()` as that same user): **denied, `sqlstate=P0001`,
  `"Only an admin can change the status of an account deletion request"`**. Static test
  `tests/db/account-deletion-execution.test.ts` ("account_deletion_requests: status/processed_by
  cannot be raw-forged by the requester") read in full: uses a real disposable throwaway auth
  account (not a mock), confirms the forge is rejected **and** that no real anonymisation side-effect
  occurred (`profiles.is_deleted` stays `false`), and separately proves that even an admin attempting
  to set `processed_by` to someone else's id gets server-overwritten to their own real id. Frontend
  diff confirmed consistent: `src/lib/queries/privacy.ts`'s `markDeletionRequestProcessed()` no
  longer accepts/sends a client-supplied `processedBy` argument at all (removed, not just ignored);
  `src/routes/dashboard.admin.users.tsx` updated to match (drops its now-unused `useAuth` import).
- **Candidate fix status**: `7ba7b32` (finalisation clone only) was **not applied** — Bot 2's own
  commit message states it deliberately reimplemented from scratch rather than cherry-picking any
  Bot 1 candidate branch, per this session's standing discipline. The candidate remains unused,
  un-merged, un-pushed, exactly as before.
- **Release-blocker status**: Was yes, **now cleared**.
- **Integration-blocker status**: **Real, concrete conflict** — the frozen frontend worktree
  (`ux-marketplace-frontend-pass`, HEAD `727d551b`, confirmed unchanged) still contains the **old**
  3-argument call `markDeletionRequestProcessed(id, status, userId!)` and still imports `useAuth` in
  `dashboard.admin.users.tsx` (confirmed by `git show` against that branch directly, read-only). This
  will not silently misbehave (TypeScript will reject the extra argument at compile time once this
  branch is integrated against current `main`), but it is a real, concrete merge-guidance item for
  Bot 2 — see the Frontend Integration Update section below.
- **Remaining risk**: none security-relevant. One real, low-severity frontend integration item
  (above), not a defect in the fix itself.

---

## DV-4 / §5.4 — `moderation_cases` self-resolution

- **Severity**: High. **Confidence**: High (live-confirmed via `pg_policies`).
- **Latest main HEAD reviewed**: `ac612690`.
- **Effective mechanism**: table `public.moderation_cases`; RLS policy `moderators and admins manage
  all moderation cases` (`ALL`, `roles={authenticated}`, `qual`/`with_check = is_moderator()`) — no
  exclusion for a moderator who is themselves the reported/affected party, or otherwise conflicted on
  that specific case. A second policy, `affected user sees their case only via the safe view`
  (`SELECT`, `qual = false`), blocks direct table reads for the affected party but does **not**
  constrain what a moderator (who might simultaneously be the affected party in a different case, or
  named as the reported party in this one) can write.
- **Real actor**: any user holding the moderator role, where that same user is also the
  reported/affected party (or otherwise conflicted) on the specific case being resolved.
- **Exact reproduction**: as a moderator whose own account is the subject of case `X`, `PATCH
  /rest/v1/moderation_cases?id=eq.X` setting `status` to a resolved/dismissed state, bearer token =
  that moderator's own session. RLS's `is_moderator()` check passes regardless of the case's subject.
- **Current status**: **FIXED — empirically verified.** Fixing commit `1f8150b`, migration
  `20260101014800_moderation_case_self_conflict_lock.sql`. Implemented as a `BEFORE UPDATE` trigger
  (`prevent_moderator_self_case_conflict`) rather than an RLS policy change — deliberately, per its
  own comment, since `SECURITY DEFINER` RPCs bypass RLS but never bypass triggers, closing both the
  RPC path (`claim_moderation_case()`) and the raw-update path in one place. **No admin exemption**
  — correct per the DV-4 checklist's own framing ("admin is not silently exempt"): this is a
  conflict-of-interest check, not a trust check. **Field-list completeness independently verified**
  this pass against the live `\d moderation_cases` column list (15 columns): the trigger protects
  `status`, `decision`, `decision_explanation`, `resolved_at`, `assigned_moderator_id`,
  `public_decision_summary` — every decision-relevant column in the live schema; `appeal_status`/
  `appeal_deadline` are correctly excluded (owned by the affected user's own legitimate
  `submit_moderation_appeal()` flow, confirmed by the migration's own comment that a first, broader
  version was caught blocking that path by the full test suite and narrowed before commit).
  **Empirical reproduction this pass** (rollback-wrapped: granted `moderator` role to a real seeded
  profile `10000000...0003`, inserted a real case with `affected_profile_id` = that same profile,
  attempted both paths as that conflicted actor): RPC `claim_moderation_case()` → **denied,
  `sqlstate=P0001`, `"You cannot manage or decide a moderation case that concerns your own
  account."`**; raw `UPDATE ... SET status='dismissed'` → **denied, identical message/SQLSTATE**,
  confirming both paths hit the same trigger as claimed. Static test
  `tests/db/moderation-case-claim.test.ts` ("claim_moderation_case: a moderator cannot claim or
  decide a case about their own account") read in full: covers both paths with a real dual-role
  actor, plus confirms an independent (non-conflicted) actor can still claim and decide normally.
  Reporter-identity privacy unaffected (the pre-existing `SELECT qual=false` safe-view policy is a
  separate, untouched mechanism).
- **Candidate fix status**: N/A — no Bot 1 candidate branch existed for this finding.
- **Release-blocker status**: Was yes, **now cleared**.
- **Integration-blocker status**: No known frontend conflict.
- **Remaining risk**: none identified.

---

## DV-5 / NEW-H3 — `achievements.verification_status` owner self-verification

- **Severity**: High. **Confidence**: High (live-confirmed via `pg_policies`).
- **Latest main HEAD reviewed**: `ac612690`.
- **Effective mechanism**: table `public.achievements`; RLS policy `owners manage their kennel's
  achievements` (`ALL`, `roles={authenticated}`, `qual`/`with_check = owns_org(kennel_id)`) — no
  column-level restriction, so the owner can raw-`UPDATE` `verification_status` directly to
  `'approved'`. Public-read policy (`public reads verified achievements of public approved kennels`)
  then immediately surfaces it: `verification_status = 'approved' AND` the org is
  `verification_status='approved' AND is_public`.
- **Real actor**: an organisation owner, on their own kennel's achievement row. Not reachable through
  the real app UI (`achievement-form-dialog.tsx` never sets this field) — raw Data API only.
- **Exact reproduction**: `PATCH /rest/v1/achievements?id=eq.<own_achievement_id>` with
  `{"verification_status":"approved"}`, bearer token = the owning org's owner session, where the
  org itself is public/approved. Immediately publicly visible as a "verified" trust signal.
- **Current status**: **FIXED — empirically verified.** Fixing commit `55bc8de`, migration
  `20260101014900_achievement_self_verification_lock.sql`. `BEFORE INSERT OR UPDATE` trigger,
  `is_admin()` exempted (correctly — admin *is* the trusted reviewer here, unlike DV-4's conflict-of-
  interest shape). **Field-list completeness independently verified** against the live `\d
  achievements` column list (12 columns): trigger protects `verification_status`, `admin_notes`,
  `reviewed_at` — every review-related column present in the live schema (no `reviewed_by` column
  exists at all, so nothing was missed there); ordinary content columns (`title`, `issuing_body`,
  `achieved_on`, `evidence_url`) correctly left owner-editable. **Empirical reproduction this pass**
  (rollback-wrapped: inserted a real achievement on a real seeded kennel/parent-dog pair owned by
  `10000000...0003`, attempted self-approval as that same owner): **denied, `sqlstate=P0001`,
  `"Only an admin can verify or review an achievement."`**. Static test
  `tests/db/organisation-trust-state-consistency.test.ts` ("achievements: an organisation cannot
  self-verify its own achievement") read in full: covers self-approve rejection (including the
  forged `reviewed_at`/`admin_notes` attempt), confirms ordinary content edits still succeed for the
  owner, and confirms genuine admin approval still works end-to-end.
- **Candidate fix status**: `3f4db66` (finalisation clone only, previously confirmed collision-free
  and reusable) was **not applied** — Bot 2 reimplemented independently from scratch, same
  discipline as DV-3. Landed fix is functionally equivalent to what `3f4db66` proposed. The candidate
  remains unused, un-merged, un-pushed.
- **Release-blocker status**: Was yes, **now cleared**.
- **Integration-blocker status**: No known frontend conflict (not reachable through the real UI
  today either way).
- **Remaining risk**: none identified.

---

## Previously-fixed findings requiring ongoing regression checks

| Finding | Fixing commit/migration | What to re-check each delta |
|---|---|---|
| Fundraising self-publication | `20260101014000` | A fundraising campaign still cannot be raw-published to `active`/public without admin approval |
| Fundraising approval audit trail | `7926f8a` / `ac61269` (this lineage's own real-source commits) | Approving a campaign still writes exactly one correct audit event, no duplicates, no missing actor |
| Organisation verification self-protection | `20260101011700` | Org owner still cannot self-set `organisations.verification_status = 'approved'` |
| `animal_ownership_history` immutability | `20260101012900` | Table remains append-only — no UPDATE/DELETE path for any non-service-role actor |
| Raw Postgres error sanitisation | `getFriendlyErrorMessage`, 34 call sites | Customer-facing errors remain sanitised; no raw SQLSTATE/constraint-name leakage in new code paths |
| Legal-hold protection for self-delete paths | `58c1589`/`6dbba45` (Stage FA-4) | Legal holds still block the specific `buyer_applications` self-delete path FA-4 closed, and any newly-added self-delete path is checked against the same blocker graph |
| Transport draft deletion | migration `20260101014100_draft_delete_cascade_lock_fix.sql` (test-hygiene fix) | Normal (unsubmitted) draft deletion still works; a *submitted* request remains protected from deletion |
| `submit_transport_request` atomicity and saved-draft submission | **`20260101014400_submit_transport_request_atomic_rpc.sql`, commits `50f1565`/`2fb1541`** — fixed in the `ac61269→e8cf707` delta, corrected from this register's own first draft which mis-cited an earlier, unrelated migration as already having closed this. See the Delta Verification Log below for full detail. | The RPC remains atomic (all-or-nothing); submitting a previously-saved draft updates the existing row in place rather than creating a duplicate; request actor (`requester_profile_id`) remains server-derived, not client-suppliable; status history is written exactly once per transition, not duplicated on retry |

---

## Register maintenance note

This register is updated at each delta-verification checkpoint (Phase 3 of the current task) as
each finding's status changes. See `docs/BOT1_OVERNIGHT_FINAL_HANDOFF.md` for the broader pass
history this register sits within.

---

## Delta Verification Log

### Delta 1 — `ac612690` → `e8cf7073098024e31a003514078399f81af58179`

Reviewed via `git -C /p/the-puppy-passport log --oneline`/`diff --stat`/`diff` between the two HEADs
(committed source only, no uncommitted files inspected). 3 commits:

1. **`50f1565` "Convert createTransportRequest to an atomic RPC, fix a real submit bug"** +
   **`2fb1541`** (commit-hash-fill-in follow-up). New migration
   `supabase/migrations/20260101014400_submit_transport_request_atomic_rpc.sql` (220 lines, read in
   full), new RPC `public.submit_transport_request(p_request jsonb, p_draft_id uuid default null)`
   (`SECURITY DEFINER`, `EXECUTE` revoked from `public`/granted only to `authenticated`). Closes a
   real, previously-open item from `docs/TRANSACTIONAL_WORKFLOW_BOUNDARIES_AUDIT.md` (non-
   transactional request+history writes) **and** a second, more severe, previously-undocumented bug:
   the public standalone transport-request form always auto-saves a draft first, then resubmission
   attempted a second `INSERT` with the *same* id, which necessarily violated the primary key and
   always failed — i.e. submitting any previously-saved draft was completely broken before this fix.
   - **Relation to the 5 open Highs**: **none — disjoint code path.** This RPC only ever transitions
     `status: 'draft' → 'submitted'` (guarded by `t.requester_profile_id = v_requester and
     t.status = 'draft'` in its own `WHERE` clause, not relying on RLS alone). DV-1/NEW-H1 concerns
     the unrelated `quotation_sent → accepted_by_customer` transition on an already-submitted
     request, gated by a different trigger clause entirely. No overlap, no regression risk to DV-1.
   - **Own-merit review**: ownership + current-status checked server-side in the `UPDATE ... WHERE`
     clause (defense in depth beyond RLS); `requester_profile_id` is always `auth.uid()`-derived,
     never taken from the client payload (confirmed by reading the function body — the payload's
     `id` is extracted and passed as `p_draft_id`, never as `requester_profile_id`); initial
     `transport_status_history` row written in the same transaction/statement list. `src/lib/queries/
     transport.ts`'s `createTransportRequest()` now calls this RPC instead of two raw writes;
     `src/routes/_public.transport.request.tsx` no longer performs the now-unnecessary
     separate best-effort draft-delete after submission. New tests added in
     `tests/db/transport-domain.test.ts` (read by name, not re-executed live this round): fresh-
     submission atomicity, in-place draft update with no duplicate-key failure, ownership
     enforcement ("cannot submit another user's draft"), re-submission guard ("cannot re-submit an
     already-submitted request"), and actor-forgery resistance ("a forged requester_profile_id in
     the payload is ignored") — directly matching the regression-test shape this register itself
     specifies for this finding. Commit message states "1034/1034 tests, verified on a fresh reset
     plus one more run without reset" — **not independently re-executed by this Bot 1 pass**, taken
     as Bot 2's own claim, not verified firsthand.
   - **Register correction**: this register's own first draft (committed `84c0cf5`, minutes earlier)
     mis-cited this exact gap as already closed by an older migration
     (`20260101006700_create_transport_draft_rpc.sql`, which only ever built the *draft-saving* RPC,
     not final submission atomicity). Corrected above. This is exactly the kind of drift the
     delta-verification loop exists to catch.
   - **Status**: **Fixed** (new fix, not a regression check of a prior fix — this was genuinely open
     immediately prior to this delta).

2. **`e8cf707` "Correct the record: Bot 1 is a real independent auditor after all"**. Docs-only,
   2 lines added to `docs/AUTONOMOUS_BACKEND_PROGRESS.md`. Bot 2 correcting its own earlier-recorded
   conclusion (an "FA-2" self-audit stage had concluded "no Bot 1 process exists" because it only
   checked the primary repo; Bot 2 now documents that Bot 1 runs from sibling read-only clones, each
   a real git clone of this repo's history). No code/schema/security change. No action required.

3. **Migration-prefix/count check**: `20260101014400` — no collision with any existing prefix on
   `main` (including the two prefixes this register already tracks for candidate-fix staleness,
   `20260101013600` and the finalisation-clone-only candidate fixes, neither of which this delta
   touches).

**Net effect of Delta 1 on the 5 open High findings**: **none — all 5 remain exactly as recorded
above, no regression, no fix.** One real, unrelated, well-executed fix landed and is recorded;
register corrected in the same pass it was found stale.

**Last-reviewed HEAD after this delta**: `e8cf7073098024e31a003514078399f81af58179`.

---

### Delta 2 — `e8cf7073098024e31a003514078399f81af58179` → `92e8126cb6a4a2ca4bf5a96dad7226195d2d05ac`

Coordinator-reported HEAD `b901f377173bd28ee3173064d38f3e43d2a9cc4c` was independently re-confirmed
real (all 5 fixing commit hashes, all 5 migration files present on disk, migration count 151) before
any of this section was written — the claim was not trusted blindly. One further commit
(`92e8126`, docs-only) landed after that report and is included here; `main` has been stable at
`92e8126` across 3 consecutive checks spanning this entire review.

**10 commits reviewed in full** (`git log --oneline`): `66383af`/`82791e5` (HF-4), `b05d527`/
`48c63de` (HF-2), `6cff166`/`f3dc476` (HF-1), `1f8150b`/`d062741` (HF-3), `55bc8de`/`b901f37` (HF-5),
`92e8126` (docs-only closeout). **5 new migrations read in full**: `20260101014500` (HF-4),
`20260101014600` (HF-2), `20260101014700` (HF-1), `20260101014800` (HF-3), `20260101014900` (HF-5).
**5 new/extended test files read in full or in relevant part**:
`tests/db/quotation-dispatch-atomic-rpcs.test.ts`, `tests/db/notification-preferences.test.ts`,
`tests/db/account-deletion-execution.test.ts`, `tests/db/moderation-case-claim.test.ts`,
`tests/db/organisation-trust-state-consistency.test.ts`. **2 frontend files reviewed**:
`src/lib/queries/privacy.ts`, `src/routes/dashboard.admin.users.tsx`.

**Verification method, in order**:
1. Static code review of every migration + relevant live-catalog cross-check (grants, RLS, trigger
   bodies, full column lists) against the actual running local Supabase instance — not just the
   migration text — for all 5 findings. Full detail folded into each DV-1..DV-5 section above.
2. Static read of every new/extended regression test in full for all 5 findings.
3. **Independent empirical reproduction** (this pass's own, not Bot 2's test suite): 5 real attacks
   attempted directly via `psql` against the shared local Supabase instance, each real lower-trust
   seeded actor impersonated via `request.jwt.claims` GUC (the same mechanism `auth.uid()` reads in
   production), each wrapped in `BEGIN ... ROLLBACK` for zero footprint, confirmed clean by a
   post-check counting each test row (`0` for all 4 inserted-and-rolled-back rows, plus the
   already-seeded transport request's status confirmed unchanged). All 5 denied with the exact
   expected `P0001` SQLSTATE and message. Full transcript preserved in this pass's own scratch
   directory (not committed — temporary working file only, per the task's `.audit-temp/`-only rule
   for temporary artifacts, though this specific file lived outside that path in the shared
   scratchpad and was not itself part of this repo).
4. **Independent, non-DB static toolchain verification**: created a throwaway clone
   (`/p/the-puppy-passport-bot1-tsc-check-*`, deleted immediately after use, never committed to
   anywhere) at the exact `92e8126` HEAD, ran `npm ci` (clean), `npx tsc --noEmit` (**clean, zero
   errors**), `npm run build` (**clean, both client and SSR/Nitro/Cloudflare-Worker bundles
   produced successfully**), `npm run lint`. **Lint was NOT fully clean**: 21 ESLint/Prettier errors
   and 13 warnings — all in files **untouched by any of the 5 HF fixes** (`src/lib/auth/guards.ts`,
   `src/lib/queries/fleet.ts`, `src/lib/queries/pricing.ts`, `src/routes/_public.how-it-works.tsx`,
   `src/lib/i18n/index.tsx`, `src/routes/_public.transport.request.tsx`), confirmed pre-existing
   lint debt unrelated to and not introduced by this delta, not a regression. This is a real,
   independently-discovered correction to any assumption that "lint baseline" means zero findings —
   recorded honestly rather than omitted. Migration count independently re-confirmed: **151**,
   matching Bot 2's own claim; zero duplicate prefixes.
5. **Not performed this delta**: a full `db:reset` + `test:db` suite run (destructive/stateful,
   would compete with a possibly-still-active Bot 2 for the shared instance; `main` had moved 3 times
   in the window immediately preceding this review, so "Bot 2 has stopped" was not yet established
   with confidence at review time). Bot 2's own claimed counts (1034→1062 tests, verified via fresh
   reset + repeat runs, `tsc`/lint/build/`db:preflight`/`db:contract-check` clean at every stage,
   read in full from `docs/HIGH_FINDING_CLOSEOUT.md`) are recorded as **Bot 2's own claim, not
   independently re-executed by this pass** — this pass's own tsc/build check (item 4 above)
   independently corroborates the tsc/build portion of that claim; the DB-suite portion remains
   Bot 2's claim pending a full Phase 6 fresh-reset pass once `main` is confirmed quiet for longer.

**Net effect of Delta 2 on the 5 High findings: all 5 FIXED.** Each with its own effective migration,
matching regression test, and this pass's own independent empirical denial. Cross-fix regression
check (Phase 4): diff scope for this entire delta touched only the files listed above — none of the
previously-fixed findings' own files (fundraising, `animal_ownership_history`,
`getFriendlyErrorMessage` call sites, legal-hold propagation, transport draft deletion,
`submit_transport_request`) were touched, so by construction there is no regression risk to any of
them from this delta.

**Real frontend integration conflict found** (see also the DV-3 entry above and the Frontend
Integration Update section): the frozen `ux-marketplace-frontend-pass` branch (HEAD `727d551b`,
confirmed unchanged, read-only `git show`) still calls the **old** 3-argument
`markDeletionRequestProcessed(id, status, userId!)` signature and still imports `useAuth` in
`dashboard.admin.users.tsx` — both changed by HF-1's fixing commit `6cff166` on `main`. Will surface
as a TypeScript error at integration time (not a silent runtime bug), but is real, concrete
merge-guidance Bot 2/frontend-integration should know about ahead of time.

**Last-reviewed HEAD after this delta**: `92e8126cb6a4a2ca4bf5a96dad7226195d2d05ac` (stable across 3
consecutive checks spanning this entire review).
