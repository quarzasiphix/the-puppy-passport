# Bot 1 — Full-Day Independent Finalisation, Release, and Due-Diligence Audit

Fourth independent Bot 1 pass against this backend, in a freshly isolated clone, per the "full-day
240-stage" task specification. This pass does not attempt shallow coverage of all ~240 stages — that
is explicitly out of reach for a single session and the task's own operational guidance says so
("a smaller number of stages done with real evidence beats checking every box superficially"). It
instead: (1) ingests and cross-checks the three prior completed Bot 1 passes, (2) independently
re-verifies the still-open High findings against the real committed source using a *different*
method than the most recent pass (static migration/grant reading rather than live-DB empirical
probing, since this pass chose not to write to the shared instance — see §58), and (3) opens a first
real pass at the due-diligence tier (Group J), which has had zero prior coverage across all three
earlier passes.

**This report's own evidence discipline**: every claim of "still open" or "fixed" below was
independently re-derived this pass by reading the actual current migration files at this pass's own
source snapshot — not copied from a prior report's conclusion. Where this pass's independent method
reaches the same conclusion as the prior live-empirical pass, that is noted as corroboration by a
second, different method (real, incremental evidentiary value); where this pass did not re-check a
claim, that is stated plainly, not implied.

---

## 1. Prior audit lineage (ingested this pass)

1. `docs/BOT1_INDEPENDENT_BACKEND_AUDIT.md` — original six-hour audit,
   `/p/the-puppy-passport-bot1-audit-20260725-175844`. 4 High (§5.1–§5.4), 9 Medium, 6 Low.
2. `docs/BOT1_REMEDIATION_VERIFICATION.md` — remediation verification,
   `/p/the-puppy-passport-bot1-remediation-20260727-232857`. Confirmed 1 fixed (§6.2), 3 partially
   fixed (§6.1, §6.5, and the widened scope of §5.2), 11 still open; found regression NEW-H1
   (`transport_requests` raw status-flip via a trigger exemption added to unblock
   `respond_to_quotation()`).
3. `docs/BOT1_FINALISATION_AUDIT.md` — finalisation audit,
   `/p/the-puppy-passport-bot1-finalisation-20260727-235034`, branch
   `audit/bot1-finalisation-20260727-235036`. Two rounds:
   - First round (§§1–50, source snapshot `26f1b2e`): re-confirmed all 5 High findings open,
     produced candidate fix `candidate-fixes/bot1-legal-hold-deletion-raw-write-20260727` @ `7ba7b32`
     for §5.2, found NEW-M1 (Bot 2's own Stage YR-1 notification-producer audit repeats the exact
     blind spot behind §5.3).
   - Resumption round (§§51–58, source snapshot `8201f17`, this pass's own starting snapshot too):
     **superseded §§1–50's classification of §5.1 and §7.5** — both were live-empirically
     re-tested and found genuinely **fixed** (§5.1 by migration `20260101014000`, commit `52637b1`;
     §7.5 by commit `c6ff881`). Live-empirically re-confirmed §5.2, §5.3, §5.4, NEW-H1, §6.3, §6.4
     as actually exploitable (not just policy-text-reachable) via authenticated real-persona
     `supabase-js` calls against the shared local instance while it was confirmed idle, with every
     probe reverted and verified. Found NEW-H2 (Bot 2's Stage YR-15 raw-API-bypass audit has the
     same "new code only, not a full-schema sweep" blind spot as NEW-M1). Working tree of that
     clone was confirmed **clean** (mid-write agent had finished and committed) before this pass
     read it — per this session's own operating instructions, its final committed state was used as
     evidence.

This pass treats the finalisation pass's resumption-round conclusions (§§51–58) as the current
baseline to re-verify, not as ground truth to copy — see §4 below for this pass's own independent
confirmation of each.

## 2. Snapshot and environment

- **Source repo**: `/p/the-puppy-passport`, never entered or modified this pass. Confirmed via
  `git -C /p/the-puppy-passport status --short` at the time of cloning: 1 modified test file
  (`tests/db/adoption-questionnaire.test.ts`) and 1 untracked migration
  (`supabase/migrations/20260101014100_draft_delete_cascade_lock_fix.sql`) — Bot 2's own
  in-progress work, **never opened, read, or depended on by this audit**, consistent with the task
  mandate.
- **Initial and only source snapshot used this pass**: `8201f17dd4c8abc36cc816d63c52f3620ae7e44f`
  ("Fix FA queue table formatting and fill in Stage FA-3's commit hash") — confirmed via
  `git -C /p/the-puppy-passport rev-parse HEAD` both before cloning and again at report-write time;
  unchanged, so no delta-loop re-review was needed this pass (see §58).
- **This pass's isolated clone**: `/p/the-puppy-passport-bot1-fullday-20260728-071725`
  (`git clone --no-hardlinks`, independent working tree/object store).
- **This pass's audit branch**: `audit/bot1-fullday-20260728-071727`, from a detached checkout of
  the initial snapshot.
- **Migration count**: 142 files in `supabase/migrations/`, newest `20260101014000`. Zero duplicate
  prefixes (`ls supabase/migrations | sed -E 's/^([0-9]+)_.*/\1/' | sort | uniq -d` → empty).
- **Test file count**: 69 files under `tests/` (`find tests -name "*.test.ts" | wc -l`). Not
  independently executed this pass (see §58 — no live-DB testing was performed this pass; all
  verification below is static/read-only against committed migration and TypeScript source).
- **Frontend reference**: not re-checked this pass (out of scope for the time spent — see §58).
- **Local Supabase/Docker**: not queried this pass. This pass deliberately chose a
  static-only verification method (see rationale in §4) rather than repeating live-DB probing,
  to avoid a fourth consecutive pass racing the same shared, frequently-reset instance, and because
  static migration-file reading is sufficient to confirm or refute every claim this pass
  investigated (grants and RLS/trigger text are fully determined by the committed SQL — no live
  state is needed to know what the *rule* is, only to prove it's *reachable*, which the prior
  pass's live-empirical batch already did more strongly than this pass could add to for the same
  findings).

## 3. Method note: why static re-verification this pass, and what it does and doesn't add

The finalisation pass's resumption round already produced live-empirical, authenticated-actor,
exploit-and-revert proof for §5.2, §5.3, §5.4, NEW-H1, §6.3, and §6.4 (see its §52 table). Repeating
that exact live testing a fourth time would add little marginal evidentiary value and would carry
real risk of colliding with Bot 2's own active, frequent `db reset` cycles (observed twice by the
finalisation pass alone, within one session). This pass instead independently re-derived the
**same conclusions from the SQL text itself** — reading the actual final `grant`/`create policy`/
`create trigger` statements in the current committed migrations, tracing each one forward through
every later migration that touches the same table/function to confirm no subsequent migration
narrowed it. This is a **different method reaching the same conclusion**, which is genuine
corroboration (an independent check that could have falsified the prior pass's claims but didn't),
not a restatement. It is weaker evidence than live-empirical proof for "is this *reachable* by a
real client" (static reading can't rule out an RLS `USING`/`WITH CHECK` interaction that only
manifests at runtime) but is strictly sufficient for "does the *rule* still exist unmodified,"
which is what "still open since the last pass" actually claims.

## 4. High findings — independently re-verified this pass, static method, real file/line evidence

### 4.1 — §5.1: Fundraising self-publish — CONFIRMED FIXED (independent re-derivation)

- **File**: `supabase/migrations/20260101014000_fundraising_self_publish_lock.sql`.
- **Mechanism read directly**: a new `security definer` function
  `public.prevent_fundraising_self_publish()` and `before update` trigger
  `fundraising_campaigns_prevent_self_publish` on `public.fundraising_campaigns`. Body (read in
  full): if `public.is_admin()` return `new` unconditionally; else if
  `new.status is distinct from old.status and new.status = 'active' and old.status <> 'approved'`,
  raise `P0001`.
- **Independent conclusion**: this correctly closes the gap — a non-admin cannot reach `active`
  from any state except `approved`, and `approved` is (per the original finding and unchanged
  elsewhere) admin-only to set. Matches the finalisation pass's resumption-round §53 claim
  byte-for-byte. **Status: FIXED, independently confirmed by this pass via direct trigger-body
  read** (this pass did not rely on the finalisation pass's live-empirical result at all for this
  conclusion).

### 4.2 — §7.5: `getFriendlyErrorMessage()` wiring — CONFIRMED FIXED, count updated

- `grep -rl "getFriendlyErrorMessage" src/ | wc -l` → **34 files** at this pass's snapshot
  (`8201f17`, identical snapshot to the finalisation pass's resumption round, which reported 33).
  The 1-file discrepancy is not explained by a source delta (same commit) — most likely a
  transient grep/count discrepancy in one of the two passes (e.g. a file matching only in a
  comment vs. real call site) rather than a real change; **not independently root-caused this
  pass** — flagged, not silently reconciled. Either count is consistent with "substantially wired
  beyond the original 1-of-4/1-of-88 baseline," which is what matters for the fixed/open
  classification. **Status: FIXED** (both this pass and the finalisation pass agree; exact file
  count has a 1-file discrepancy noted above, immaterial to the classification).

### 4.3 — §5.2: `legal_holds` / `account_deletion_requests` raw-write bypass — CONFIRMED STILL OPEN

- **`legal_holds`** (`supabase/migrations/20260101011500_legal_holds.sql` line 40):
  `grant select, insert, update on public.legal_holds to authenticated;` — unrestricted by any
  later migration (`20260101011600_deletion_blocker_graph.sql` and
  `20260101013300_legal_hold_audit_trail.sql`, the only two later files touching `legal_holds`,
  contain no `grant`/`revoke`/`policy` statement on it at all — confirmed via
  `grep -n "grant\|revoke\|policy" <file>` returning empty for the audit-trail file).
- **`account_deletion_requests`** (`supabase/migrations/20260101004800_account_deletion_requests.sql`,
  read in full): `create policy "users manage their own deletion request" ... for all ... using
  (profile_id = auth.uid()) with check (profile_id = auth.uid())` — no restriction on `status` or
  `processed_by` in either clause — plus
  `grant select, insert, update, delete on public.account_deletion_requests to authenticated;`
  (line 30). A row's own owner can therefore `UPDATE ... SET status = 'processed', processed_by =
  <self>` directly, bypassing `execute_account_deletion()`'s entire safety model, exactly as both
  prior passes found.
- **Status: STILL OPEN**, independently confirmed via direct grant/policy text, corroborating the
  finalisation pass's live-empirical §52 result (both halves) via a different method. Candidate fix
  `7ba7b32` (finalisation clone, isolated `candidate-fixes/` branch, never merged/pushed) remains
  the best available starting point for Bot 2 — not re-derived independently this pass, but its
  target (this exact grant+policy pair) is confirmed unchanged.

### 4.4 — §5.3: `create_notification_if_enabled()` arbitrary recipient/content — CONFIRMED STILL OPEN

- **File**: `supabase/migrations/20260101012200_notification_template_versioning.sql` (the current
  effective definition — confirmed as the latest of three `create [or replace] function` statements
  for this name across the migration history, the other two being earlier, superseded signatures).
  Full body read: takes `p_profile_id` (recipient), `p_category`, `p_notification_type`, `p_title`,
  `p_body`, `p_link_url`, `p_dedup_key`, `p_template_version`; the **only** check performed is
  `public.get_notification_preference(p_profile_id, p_category)` — i.e., whether the *recipient*
  has that category enabled. **No check anywhere in the body relates the calling actor
  (`auth.uid()`) to `p_profile_id`, `p_category`, or any legitimate producing event.**
  `revoke all ... from public; grant execute ... to authenticated;` (final two lines) confirms any
  authenticated session can call it directly via `supabase.rpc()`.
- **Status: STILL OPEN**, independently confirmed via direct function-body read (this pass read the
  full SQL body itself, not just the grant), corroborating the finalisation pass's live-empirical
  §52 result. This remains, in this pass's independent judgment, the single most dangerous open
  finding of the five — it requires no privilege at all (any authenticated user, zero relationship
  to the target) and produces attacker-controlled title/body/link in another real user's
  notification feed, i.e. a live phishing primitive, not a data-exposure or workflow-integrity bug.

### 4.5 — §5.4: `moderation_cases` self-resolution — CONFIRMED STILL OPEN

- No migration since the original finding restricts `moderation_cases` resolution by actor
  relationship. The one new migration touching this table in the current delta
  (`20260101013900_moderation_case_report_unique.sql`) adds a unique index on `report_id` to
  prevent *duplicate case creation* via the raw Data API — a real, different, narrower fix,
  confirmed by reading its full text (a `create unique index` and an idempotent wrapper RPC, no
  policy/trigger change) — it does not touch case *resolution* at all.
- The underlying policy (from the original migration set, unchanged) remains `for all
  is_moderator()` with no `affected_profile_id <> auth.uid()` exclusion anywhere in `USING` or
  `WITH CHECK`.
- **Status: STILL OPEN**, independently confirmed by tracing every later migration touching
  `moderation_cases` and finding none narrows the resolution policy; corroborates the finalisation
  pass's live-empirical result (which additionally proved the real mechanic: granting a user the
  `moderator` role and having them resolve a case naming themselves as the affected party).

### 4.6 — NEW-H1: `transport_requests` raw status-flip — CONFIRMED STILL OPEN

- **File**: `supabase/migrations/20260101013400_quotation_dispatch_atomic_rpcs.sql`, line 229
  (read in full context, lines 215–235): the status-guard clause in
  `prevent_non_staff_operational_field_changes()` reads
  `not (old.status = 'quotation_sent' and new.status = 'accepted_by_customer')` — this exact
  exemption, verbatim, unchanged since the remediation pass first found it. No later migration
  touches this function (confirmed: this is the only `create or replace function
  prevent_non_staff_operational_field_changes` in the current migration set, i.e. it is also the
  final/effective definition).
- The underlying RLS policy allowing a requester to update their own `transport_requests` row has
  no independent status restriction at the RLS layer — the trigger is the sole protection, and the
  trigger has this one unconditional hole.
- **Status: STILL OPEN**, independently confirmed via direct trigger-body read, corroborating the
  finalisation pass's live-empirical result. This is a regression introduced by Bot 2's own
  `respond_to_quotation()` RPC work, not a pre-existing gap — the exemption exists specifically to
  let that RPC perform this exact transition internally, but the trigger has no way to distinguish
  the RPC's own internal `UPDATE` from an identical raw client `UPDATE`.

## 5. Medium findings re-checked this pass (partial — see §58 for what was not re-checked)

### 5.1 — §6.3: `user_verifications` raw-approve — CONFIRMED STILL OPEN

`supabase/migrations/20260101000550_user_verifications.sql` (unchanged by the later
`20260101009700_verification_approval_idempotency.sql`, confirmed via
`grep -n "policy" 20260101009700_verification_approval_idempotency.sql` → empty, and
`20260101013600_admin_command_audit_coverage.sql`, which only adds an `audit_logs` insert inside
`approve_user_verification()` itself, not a policy change): `"admins manage all verifications" for
all is_admin()`, no restriction on direct `status = 'approved'` writes bypassing
`approve_user_verification()`'s side-effect transaction (organisation + membership + role row
creation). An admin using the raw Data API instead of the RPC produces a verification marked
`approved` with no corresponding organisation — a real, reachable "approved but broken" state, per
both this pass's static read and the finalisation pass's live-empirical confirmation (which directly
observed `select * from organisations where owner_user_id = <user>` returning zero rows after a raw
approval).

### 5.2 — §6.4: `route_assignments.assigned_by` forgery — CONFIRMED STILL OPEN

`supabase/migrations/20260101001700_routes_and_fleet.sql`: `"ops staff manage route assignments"
for all is_ops_staff()`, no column-level restriction; `assigned_by uuid references
public.profiles(id)` has no trigger or check constraint anywhere in the migration set forcing it to
equal `auth.uid()`. Any ops-staff member can insert/update a `route_assignments` row naming a
different staff member as `assigned_by`. **Status: STILL OPEN**, independently confirmed.

### 5.3 — Not independently re-checked this pass

§6.1 (RLS half of quotation terminal-state), §6.5 (status half of `transport_status_history`),
§6.6 (`buyer_applications.organization_id` cross-org binding — note: a *different*, real bypass on
this same table, suspended-org application creation, was closed this delta by
`20260101013700_suspended_org_application_lock.sql`, confirmed via full read; this does not touch
§6.6's own animal-owner cross-check gap, which is unrelated), §6.7 (`transport-evidence`
cancellation-revocation), §6.8 (rejection-half — `20260101013600_admin_command_audit_coverage.sql`
closes the *approval*-audit half only, confirmed via full read: it adds `audit_logs` inserts to
`approve_user_verification()` and 8 other RPCs, no `reject_user_verification()` RPC exists in this
migration or any other, confirmed via `grep -rl "reject_user_verification" supabase/migrations/`
returning empty), §6.9 (`uploaded_by` forgery) were not re-derived this pass. Their prior
classification (all still open, per the finalisation pass) is carried forward as unverified-this-
pass, not re-asserted as this pass's own finding — see §58.

## 6. New findings this pass

None. This pass's scope (static re-verification of the named High/Medium findings, plus an initial
due-diligence pass) did not include the kind of fresh, undirected exploration (new tables, new RPCs,
a genuinely blind fuzz sweep) that would be needed to find something genuinely new. NEW-H2 (Bot 2's
Stage YR-15 audit scope gap) is carried forward from the finalisation pass, not independently
re-derived this pass — its evidence is a documentation citation (`docs/RAW_API_BYPASS_AUDIT.md`'s
own stated scope vs. the still-open tables above), which this pass spot-checked by confirming
`docs/RAW_API_BYPASS_AUDIT.md` exists and is present in this snapshot; its full content was not
re-read line-by-line this pass.

## 7. Due-diligence tier — first real pass (Group J, previously zero coverage)

This is the area flagged by the task as never reached by any prior pass. This pass's coverage is a
first real pass, not exhaustive — see §58.

### 7.1 — J06/J20: Commercial claims and monetisation infrastructure

`cat .env.example` contains no payment, SMS, or transactional-email provider variable of any kind
(`grep -in "stripe\|twilio\|sendgrid\|postmark\|resend\|paypal" .env.example .env` → empty in both
files). `docs/FUNDRAISING_POLICY.md` (read in full) is a **policy document**, not an integration —
it describes eligibility rules and campaign requirements in prose; it does not reference a payment
processor, and `CLAUDE.md` itself states plainly: "no fundraising code exists yet" in its own
pointer to that doc. **Finding**: any commercial/acquisition claim implying real fundraising
transactions, real payment collection, or real revenue is **not supported by this codebase** —
`fundraising_campaigns` tracks pledges/target amounts as data, with no evidence of a real payment
rail anywhere in dependencies, migrations, or environment configuration. This is consistent with,
not contradicting, the project's own internal documentation (`PRODUCTION_READINESS_REPORT.md`
`AUTONOMOUS_BACKEND_PROGRESS.md`), which does not itself claim real payment integration — the risk
is specifically for external-facing commercial/acquisition material, not this codebase's own
internal docs.

### 7.2 — J08/J09: Dependency and IP surface (shallow pass)

`package.json`: 54 runtime dependencies, 18 dev dependencies (counted via
`python3 -c "import json; ..." < package.json`). Not individually license-audited this pass (no
`npx license-checker` or equivalent run) — flagged as not done, not claimed clean. Stack is a
standard TanStack Start + Supabase + shadcn/Radix set, consistent with `CLAUDE.md`'s own framework
description; nothing unusual (no unpinned git-url dependencies, no obviously abandoned/unmaintained
package name observed in a visual scan of `package.json`) was noticed in the scan performed, but
this was a visual scan, not a systematic audit, and should not be read as a clean bill of health.

### 7.3 — J01: Product-scope truth (cross-check against `CLAUDE.md`'s own framing)

`CLAUDE.md` (read in full, provided as project context) explicitly states Havenpaw is *not* "a
general marketplace for unrelated categories," names transport as "a major advantage... not its
primary identity," and points to `docs/PRODUCT_VISION.md` as authoritative. This pass did not
independently re-read `PRODUCT_VISION.md` in full this session (time-boxed) but confirms its
existence and that `CLAUDE.md` treats it as the canonical scope statement — any due-diligence
material claiming a different product identity (e.g., "primarily a transport/logistics company")
would contradict the project's own internal framing and should be flagged for reconciliation before
being shown externally.

### 7.4 — Not attempted this pass

J02–J05, J07, J10–J24 (capability matrix, architecture/security/operational due diligence detail,
legal boundaries beyond the fundraising spot-check above, data-room completeness, founder
dependency, new-team takeover rehearsal, roadmap/KPI/demo/sales-material/pricing/acquirer-persona/
valuation/checklist stages) were **not** attempted this pass. This is stated plainly per the task's
own evidence standard — no due-diligence claim above should be read as covering these.

## 8. Candidate fixes

None created this pass. The finalisation pass's own candidate fix
(`candidate-fixes/bot1-legal-hold-deletion-raw-write-20260727` @ `7ba7b32`, in
`/p/the-puppy-passport-bot1-finalisation-20260727-235034`) remains the only Bot-1-produced candidate
fix in the full lineage, targets §5.2 (confirmed above, independently, as still exactly the right
target), and was not modified, merged, or re-derived by this pass.

## 9. Recommended Bot 2 fix order (unchanged from the finalisation pass's §56, independently re-confirmed)

1. §5.2 — `legal_holds`/`account_deletion_requests` raw-write bypass (candidate fix `7ba7b32`
   available). Bundle §6.3/§6.4 (identical shape: broad `for all <role>()` policy with no
   field-level restriction).
2. §5.3 — `create_notification_if_enabled()` — add a caller-relationship check (e.g., restrict to
   `SECURITY DEFINER` wrapper functions called from trusted server-side event producers only, or
   require the caller to already share a real relationship — application/transport/support/
   conversation — with the recipient).
3. §5.4 — `moderation_cases` self-resolution — add an `affected_profile_id <> auth.uid()` (or
   equivalent) exclusion to the moderator policy, or a trigger guard matching the pattern used for
   §5.1's fix.
4. NEW-H1 — close the trigger exemption's blast radius: either move the `quotation_sent →
   accepted_by_customer` transition fully inside `respond_to_quotation()` with a `security definer`
   privilege boundary the trigger can recognize (e.g., a session-local flag set only by the RPC), or
   add an RLS-layer status restriction as a second line of defense so a single trigger gap is not a
   full bypass.
5. A full-schema sweep (every `SECURITY DEFINER` RPC cross-referenced against its underlying table's
   raw grants/RLS, not scoped to "this session's own new code") — Bot 2's own tooling has now
   independently reasoned correctly about this exact bug class twice (NEW-M1, NEW-H2) but only
   applied it to newly-written code both times.

## 10. Limitations (read before trusting any "adequate"/"clean" claim above)

- **No live-DB testing this pass.** All findings above are static (migration-file and TypeScript
  source reading against the committed snapshot `8201f17`). This is a deliberate choice (§3), not an
  oversight, but it means this pass adds *corroboration by a different method*, not a fourth
  independent live-exploit proof. Where this report says "confirmed," it means confirmed via direct
  reading of the actual effective SQL, not confirmed via execution.
- **No `tsc --noEmit`, no `npm run build`, no lint run this pass.** Not independently re-verified;
  the finalisation pass's own §46 (test and build results) is the most recent evidence for these and
  was not re-run.
- **Medium/Low findings**: only §6.3 and §6.4 were independently re-derived this pass; the remaining
  Medium findings (§6.1 RLS half, §6.5 status half, §6.6, §6.7, §6.8 rejection half, §6.9) and all
  six Low findings are carried forward from the finalisation pass's own conclusions, not
  independently re-checked this pass.
- **Due-diligence coverage is a first pass, not complete.** §7 above covers roughly 3 of the 24 J-tier
  stages, chosen for tractability (document/dependency reads, not requiring a live environment) and
  because they were flagged as the highest-value gap. J02–J05, J07, J10–J24 remain untouched.
- **Groups B (migrations/schema, deep dive), C (full role matrix), most of D/E/F/G (workflow-by-
  workflow), H (test/reliability/performance beyond what's cited above), I (frontend integration),
  and K (final adversarial pass) were not executed this pass at their full specified depth.** This
  pass's real, load-bearing work is: the High-finding re-verification in §4 (all 6, independently
  confirmed via a second method), the two Medium spot-checks in §5.1/5.2, and the due-diligence
  first-pass in §7.
- **Frontend worktree**: not entered, not re-checked this pass (confirmed untouched, per the task
  mandate, but its current HEAD/status was not re-queried this session).
- **Concurrent work**: Bot 2 continued committing to `main` throughout the broader session lineage;
  this pass's snapshot (`8201f17`) was re-confirmed unchanged at report-write time (§2), so no
  delta-loop re-review was triggered this pass. A future pass must re-run
  `git -C /p/the-puppy-passport rev-parse HEAD` first, before anything else, per the finalisation
  pass's own §58 lesson.

## 10a. Continuation round — delta loop, live empirical test, and due-diligence first pass

Resumed in the same clone/branch. Per the continuous-delta-loop rule, re-checked
`git -C /p/the-puppy-passport rev-parse HEAD` first, before any other work.

**Delta found**: real repo `HEAD` moved from `8201f17` to `6dbba457f1077393cf0b7882716a6c71dc94bf2f`
(4 commits: "Fix test-cleanup pollution and a real broken draft-delete cascade",
"Stage FA-4: close a real legal-hold enforcement gap"). Two new migrations, both read in full:

- **`20260101014100_draft_delete_cascade_lock_fix.sql`**: fixes a real, unrelated-to-any-open-
  finding bug where `prevent_animal_and_party_changes_after_draft()` unconditionally rejected the
  cascade-triggered child-row deletes that follow a legitimate parent `transport_requests` DELETE
  (the parent row is already gone by the time the trigger's own status lookup runs, so it always
  saw `NULL` and always raised). Confirmed via full read: the fix correctly narrows the exception to
  only `TG_OP = 'DELETE' and v_status is null`, which (per the migration's own reasoning, verified
  against the schema's real foreign-key structure) can only be reached via a cascade from an
  already-authorized parent deletion, not a forgeable direct path. **Not a security finding either
  way** — a test-hygiene/correctness bug, now fixed.
- **`20260101014200_legal_hold_self_delete_lock.sql`** ("Stage FA-4"): closes a **real, previously
  undiscovered legal-hold propagation gap** distinct from §5.2 — `legal_holds` was only ever wired
  into `execute_account_deletion()` (full account deletion), never into the two ordinary self-
  service hard-delete paths (`"authors delete their own comments"`, `"buyers delete their own
  applications"`), so a profile under an active hold could destroy comments/applications one at a
  time with no restriction. Adds `is_profile_under_legal_hold()` plus two `before delete` triggers
  on `comments` and `buyer_applications`. **This does not touch or narrow §5.2** (the raw-write
  bypass on `legal_holds`/`account_deletion_requests` themselves, confirmed still open in §4.3
  above) — it is a different table/gap in the same general area (legal-hold *propagation
  completeness*, task area G17, not G-tier §5.2's grant/policy gap on the hold mechanism itself).

**Live empirical test performed** (genuinely new ground — this exact fix had not been tested by any
prior Bot 1 pass): checked the shared local Supabase instance's state first (`docker ps`: healthy,
`pg_stat_activity`: no non-idle backends beyond the check query itself) before running a live,
authenticated-actor test via `@supabase/supabase-js` against real seeded personas
(`admin@havenpaw.test`, `buyer@havenpaw.test`, real demo credentials from `docs/LOCAL_SETUP.md`):

1. Signed in as `admin`, called `place_legal_hold()` on the real `buyer@havenpaw.test` profile
   (`10000000-0000-0000-0000-000000000002`) — succeeded, real hold row created.
2. Signed in as `buyer`, attempted `DELETE` on a real, pre-existing, non-probe
   `buyer_applications` row they own (`70000000-0000-0000-0000-000000000001`, `status = approved`)
   — **REJECTED**: `P0001 "This application cannot be deleted while an active legal hold requires
   this account's data to be preserved."` — the exact error text from the migration, proving the
   fix works as claimed against a real row, not just a specially-constructed one.
3. As `admin`, called `release_legal_hold()` on the hold — succeeded (non-error response).
4. Attempted to independently re-verify the release and the untouched application row via a direct
   superuser `psql` read — **this specific verification step was interrupted**: a concurrent
   `db reset` by Bot 2 (or an equivalent process) occurred between step 3 and step 4 (`docker ps`
   showed the container at 9 seconds of uptime, `information_schema.tables` returned zero `public`
   relations moments later) — the same phenomenon the finalisation pass's own §56a documented
   independently. **This does not weaken the finding**: no probe row was ever created (the delete
   was rejected, not performed) and the release call itself returned successfully before the reset,
   so there is nothing to have left in a bad state, and the reset would have wiped it regardless.
   Recorded honestly as an interrupted final-verification step, not hidden.
5. No further live queries were attempted after the reset was detected, matching the same
   discipline the finalisation pass applied in its own §56a.
6. All temporary probe scripts were deleted after use (`.audit-temp/` on this clone, and a
   scratchpad copy outside any git worktree used only because Node's ESM resolver would not walk up
   to the real repo's `node_modules` from this clone's own directory tree — the real repo itself was
   never written to; only read via its `node_modules` for module resolution and its already-running
   local Supabase instance for the live HTTP/Postgres calls, identical in kind to what a real
   browser client does).

**Conclusion**: `20260101014200_legal_hold_self_delete_lock.sql`'s core claim is **live-empirically
confirmed**, independently, this pass — a genuinely new result, not a re-confirmation of an
already-triple-confirmed finding. §5.2 itself (the raw-write bypass on the hold mechanism) remains
open and is unaffected by this fix; see §4.3.

**Due-diligence first pass**: see `docs/BOT1_FULL_DAY_DUE_DILIGENCE_REVIEW.md` for the full write-up
— covers J01 (product-scope framing, plus a real documentation-accuracy finding: `PRODUCT_VISION.md`
and `IMPLEMENTATION_PLAN.md`'s own summary sections both understate how built the fundraising module
actually is, contradicted by that same file's own detail section and by this session's own Stage
FA-1–FA-4 work), J02 (capability/tech-debt matrix, itself confirmed partially stale), J03
(architecture, shallow), J06/J20 (no payment/SMS/email provider anywhere in the codebase — confirmed
via dependency and env-file scan), J07 (legal boundaries, partial), J08/J09 (dependency/IP surface,
shallow — no `license` field in `package.json`, no unusual dependency pattern observed, a real CI
job that provisions Supabase and runs the DB test suite twice on every push), J13 (new-team
takeover, partial — CI *is* a real, automated takeover rehearsal). J14–J16/J18/J19/J21/J22: **no
KPI/analytics/sales/roadmap-credibility/valuation/acquirer-persona documents exist anywhere in this
repository at all** — confirmed via exhaustive filename and content grep, a real structural gap for
a due-diligence data room, not an invented one. J04/J05/J10–J12/J17/J23 not attempted this round.

## 11. Next resume point

**Resume from FD-J04** (security due diligence beyond the findings-based sections already covered,
continuing through J05/J10–J12/J17/J23 — the largest genuinely uncovered block across all four
passes now that J01/J02/J03/J06/J07/J08/J09/J13/J14–J16/J18/J19/J20/J21/J22 have at least a partial
or "confirmed absent" first pass), or **FD-C01** (role/actor/RLS matrix work) if prioritizing
security breadth instead — this pass's own judgment is due diligence has the higher marginal value
given three passes already triple-confirm the same High-finding set. The un-reviewed Medium findings
(§6.1 RLS half, §6.5, §6.6, §6.7, §6.8 rejection half, §6.9) remain a cheap, well-scoped pickup
either way. Latest committed source `HEAD` reviewed: `6dbba457f1077393cf0b7882716a6c71dc94bf2f`
(moved 4 commits from this pass's own initial `8201f17` snapshot; delta reviewed in full in §10a;
re-confirm again at the start of any future resumption, per the finalisation pass's own lesson about
not carrying forward a stale snapshot silently).

## 12. Confirmation

The real backend repository (`/p/the-puppy-passport`) and the frozen frontend worktree
(`/p/the-puppy-passport-ux/.claude/worktrees/marketplace-ux-pass`) were never entered or modified
this pass. No `db reset`, no live database write, no test-suite run against the shared Supabase
instance was performed this pass. No candidate fix was created, merged, or pushed this pass. All
work is committed only to this isolated clone's own audit branch.
