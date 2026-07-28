# Bot 1 — Remediation Matrix (Finalisation Pass)

One row per known finding, consolidated across all three Bot 1 passes (original audit, remediation
verification, this finalisation pass) plus this pass's own resumption round. Status as of the
**second** live-DB re-check this pass, against real-repo `HEAD` `8201f17dd4c8abc36cc816d63c52f3620ae7e44f`
(142 migrations — 5 more landed on `main` mid-pass: `20260101013600`–`20260101014000`, Stages
YR-7 through FA-3). "Verified" now distinguishes three evidence tiers, weakest to strongest: static
(migration-text tracing only), live-static (a live `pg_policies`/grant/trigger-body query against
the running shared instance), and **live-empirical** (an actual authenticated lower-trust-actor API
call was made against the live schema and its real result recorded, then reverted). See
`docs/BOT1_FINALISATION_AUDIT.md` §14/§51–§54 for the full empirical-testing methodology and every
raw result. This resumption round found and empirically confirmed **two real fixes** that the first
round of this same pass had marked "still open" from a stale snapshot — see §5.1/§7.5 below; this is
exactly the "check whether everything actually works" correction the resumption round was asked to
make.

| ID | Finding | Severity | Priority | Status | Fixing commit | Verified this pass | Candidate fix |
|---|---|---|---|---|---|---|---|
| §5.1 | Fundraising campaigns self-publish to `active` | High | — | **FIXED** (found this resumption round — was misreported "still open" earlier in this same pass, based on the `26f1b2e` snapshot; real-repo `main` had moved to `8201f17` mid-pass) | `52637b1`/`20260101014000` (Stage FA-3) | **Live-empirical**: built full real fixtures (accepted quotation, adoption buyer-application, all FK-linked) and attempted the exact original exploit as the real seeded org owner (`foundation1`) via `supabase-js`/GoTrue — rejected with `P0001 "A fundraising campaign can only go live after Havenpaw staff have approved it."`, thrown by a new `BEFORE UPDATE` trigger (`fundraising_campaigns_prevent_self_publish`) neither this nor either prior Bot 1 pass had ever checked for (all three only inspected the RLS `WITH CHECK`, never `pg_trigger` on this specific table) | No — already fixed, no candidate needed |
| §5.2 | `legal_holds`/`account_deletion_requests` raw-write bypass (widened: any user, own row) | High | P0 | **Still open** — confirmed unchanged even at `HEAD` `8201f17` | none | **Live-empirical**: as real `admin`, raw-inserted a `legal_holds` row forging `placed_by` — succeeded; as real `customer`, self-service-inserted then self-updated own `account_deletion_requests` row straight to `processed` forging `processed_by` — succeeded. Both probe rows deleted immediately after via superuser cleanup, verified deleted | **Yes** — `candidate-fixes/bot1-legal-hold-deletion-raw-write-20260727` @ `7ba7b32` |
| §5.3 | `create_notification_if_enabled()` arbitrary recipient/content | High | P1 | **Still open** | none | **Live-empirical**: as real `customer`, called the raw RPC targeting `ops` (zero relationship) with an attacker-controlled title/body/link — succeeded, real row created (id `6eed9b2e-...`), deleted after via superuser cleanup | No |
| §5.4 | `moderation_cases` self-resolution conflict of interest | High | P1 | **Still open** | none | **Live-empirical**: temporarily activated a real `moderator` role grant on the `customer` persona, created a real case with `affected_profile_id = customer`, then as `customer` (now also a moderator) raw-updated the case to `dismissed` — succeeded (`status` verified `dismissed` via a direct superuser read, not just the API response). Case deleted and the temporary role grant revoked immediately after | No |
| NEW-H1 | `transport_requests` raw status-flip via `20260101013400`'s trigger exemption | High | P1 | **Still open** — confirmed unchanged even at `HEAD` `8201f17` (the new `20260101013800` migration touches `change_ops_request_status()`, an unrelated ops-side function, not this trigger) | none | **Live-empirical**: as real `customer`, raw-updated their own real `transport_requests` row (id `a0000000-...003`, live status `quotation_sent`) straight to `accepted_by_customer` — succeeded, no reference to `quotations` at all. Reverted to `quotation_sent` immediately after via superuser update | No |
| §6.1 | Quotation terminal-state gap | Medium | P2 | **Partially fixed** (RPC path closed `cfd33ca`; raw RLS still open) | `cfd33ca`/`20260101013400` | **Live-empirical** (2nd resumption round, `HEAD` `6dbba45`): as real `customer`, flipped an already-`accepted` quotation to `rejected` — succeeded — then flipped it back to `accepted` — also succeeded, directly proving the "un-terminal-ize" claim, not just the one-way misuse. Instance reset before cleanup could confirm reversion by direct read, but a full reset restores seed state regardless (no residual risk) | No |
| §6.2 | `animal_ownership_history` admin-mutable | Medium | — | **Fixed** | `281f0e4`/`20260101012900` | Live-static (prior round); not re-queried this resumption round (no delta migration touches this table) | n/a |
| §6.3 | `user_verifications` raw-write bypass | Medium | P0 (bundle with §5.2) | **Still open** | none | **Live-empirical**: as real `admin`, raw-updated a real `pending` verification row straight to `approved`, bypassing `approve_user_verification()` — succeeded; confirmed the RPC's own side effects never ran (`select * from organisations where owner_user_id = <that user>` returned zero rows, proving the "approved but functionally broken" claim directly, not by inference). Reverted to `pending` immediately after | No |
| §6.4 | `route_assignments.assigned_by` forgery | Medium | P0 (bundle with §5.2) | **Still open** | none | **Live-empirical**: as real `ops`, raw-inserted a `route_assignments` row on a real unused route+request pair, forging `assigned_by` to `admin`'s id — succeeded. Row deleted immediately after | No |
| §6.5 | `transport_status_history` forged `changed_by`/unconstrained `status` | Medium | P2 (status half) | **Partially fixed** (`changed_by` closed `3e4ae1f`; `status` still open) | `3e4ae1f`/`20260101013000` | Live-static — INSERT policies re-read at `HEAD` `8201f17`, unchanged | No |
| §6.6 | `buyer_applications.organization_id` cross-org PII binding | Medium | P1 | **Still open** — a *different*, real bug in the same table was fixed this window (see note) but this specific finding was not | none | Live-static — the live INSERT policy was **redefined** this window (`20260101013700`, Stage YR-8, "buyers create applications only for currently-approved orgs") to close a suspended-org application bypass, a real, distinct, correctly-scoped fix — but its `WITH CHECK` still never cross-references `animal_id`'s actual `organization_id` against the submitted `organization_id`, re-confirmed via a fresh live `pg_policies` read of the new policy text | No |
| §6.7 | `transport-evidence` cancellation-revocation gap | Medium | P2 | **Still open** | none | Live-static — storage policies re-read at `HEAD` `8201f17` (`storage.objects`, bucket `transport-evidence`), unchanged, still no `transport_requests.status` filter | No |
| §6.8 | Verification approval/rejection audit trail | Medium | P2 | **Partially fixed this window** — approval half closed; rejection half still open | `5aba888`/`20260101013600` (Stage YR-7, "admin command catalogue + close 9 missing audit trails") | Live-static — read the current, live `approve_user_verification()` body via `pg_get_functiondef()`: it now inserts an `audit_logs` row (`user_verification.approved`) with real before/after state. No `reject_user_verification()` RPC exists (`select proname from pg_proc where proname ilike '%reject%verif%'` → 0 rows) — rejection still goes through the raw client update in `verification-review-list.tsx` with `reviewed_by`/`reviewed_at` never stamped | No |
| §6.9 | `uploaded_by` forgery on `transport_documents`/`welfare_case_documents` | Medium | P2 | **Still open** | none | **Live-empirical** (2nd resumption round, `HEAD` `6dbba45`): as real `customer`, raw-inserted a `transport_documents` row on their own real request, forging `uploaded_by` to the `ops` persona's id — succeeded, real row created. Instance reset before the delete-cleanup could run and confirm; a full reset wipes the row regardless (no residual risk) | No |
| §7.1 | `convert_application_to_reservation()` raw constraint-name leak | Low | P3 | Open (not re-verified this round either) | none | No | No |
| §7.2 | `rehoming_reviews` admin approval missing `OLD.admin_status` guard | Low | P3 | Open (not re-verified this round either) | none | No | No |
| §7.3 | `markDeletionRequestProcessed()` `declined` path trusts client `processedBy` | Low | P3 | Open — this pass's own candidate fix does not close this | none | Not re-verified this resumption round | No |
| §7.4 | ~127 unindexed FK columns | Low | P3 | Open, documented, deliberate tradeoff | none | No | No |
| §7.5 | `getFriendlyErrorMessage()` wired into 1 of 4 call sites | Low | — | **FIXED** (found this resumption round — was misreported "still open" earlier in this same pass, same stale-snapshot cause as §5.1) | `c6ff881`/no migration (pure TS, Stage YR-16) | Confirmed via Bot 2's own detailed progress-log entry (real specifics: 32 files, `tsc`/lint/build clean, exact before/after call-site count) cross-checked with a fresh `grep -rln getFriendlyErrorMessage src/` against the current real-repo working tree, which now returns 33 files (32 + the original), not 2 — a genuine, verifiable fix, not just a claim | No |
| §7.6 | `rpc-grant-hygiene.test.ts` weak `assert.ok(error)` assertion | Low | P3 | **Still open** | none | Not re-verified this resumption round (no evidence either way found in the new delta's stage descriptions) | No |
| NEW-M1 (this pass) | Bot 2's own Stage YR-1 `NOTIFICATION_PRODUCER_INVENTORY.md` claims "no forgeable-recipient surface to close here" for the notification pipeline while never mentioning `create_notification_if_enabled()`'s own direct-RPC grant/authorization gap (§5.3) — a progress-document truth-check finding, not a new code bug | Medium (doc/process) | P3 | **Confirmed still applicable this resumption round** — Bot 2's later Stage YR-15 ("Raw API bypass audit") explicitly re-derives and *names* the exact bug class ("a lower-trust actor can bypass an RPC via raw update") as the one worth checking, but scopes its sweep to *this session's own newly-added RPCs* only, and concludes the older, pre-existing raw-bypass surface (§5.2/§5.3/§6.3/§6.4, none added this session) is "not a security issue" under an explicit "trusted staff can always bypass their own RPC" model — a model that does not cover §5.2's own widened, non-staff-reachable half. See main report §36/§37 for the full analysis | none | Yes — read Stage YR-15's own doc reference and reasoning in the progress log in full | No |
| NEW-H2 (this pass, resumption round) | Bot 2's explicit "trusted staff can always bypass their own RPC via raw update, and that's not a security issue" model (Stage YR-15, `docs/RAW_API_BYPASS_AUDIT.md`) does not cover §5.2's own widened reachable-actor finding — an *ordinary, non-staff `customer` persona*, live-empirically confirmed this pass, can raw-bypass `execute_account_deletion()`'s entire safety model on their own row, which YR-15's own "lower-trust actor reaching a protected field/RPC-only transition via raw call" bug-class definition explicitly says *would* be a real bypass worth fixing — but YR-15's own sweep scope was limited to "this stage's own new migrations" (quotation dispatch, rehoming/report, admin command audit coverage, suspended-org application lock, terminal-reopen-reason) and structurally never revisits older, pre-existing tables like `account_deletion_requests`/`legal_holds`/`user_verifications`/`route_assignments`, so this exact bug class — one YR-15 says it has hunted "dozens of times already" — was never pointed at the tables where it still lives | High (process/reasoning gap, not new code) | P0 | **New this resumption round** | none | Read `docs/RAW_API_BYPASS_AUDIT.md` in full; cross-referenced its stated scope and bug-class definition against the already-empirically-confirmed §5.2 exploit (both same-pass artifacts) | No |

**Totals across all 25 rows**: **3 fixed** (§6.2, §5.1, §7.5), **3 partially fixed** (§6.1, §6.5,
§6.8), **18 still open** (4 High — §5.2/§5.3/§5.4/NEW-H3 — plus NEW-H1 (regression) and NEW-H2
(process), 8 Medium, 4 Low, 1 doc-process finding), 1 candidate fix committed. NEW-H3
(`achievements.verification_status` owner self-verification) is a genuinely new finding, found by
this pass's own undirected fuzz sweep, not a carried-forward item from either prior Bot 1 pass.
**Confidence upgrade**: **8 of the still-open/partial findings now carry live-empirical evidence**
(§5.2 both halves, §5.3, §5.4, NEW-H1, §6.1, §6.3, §6.4, §6.9 — an actual exploit was executed
against the live schema and its real result recorded) rather than policy-text tracing alone — the
strongest evidence tier any of the three Bot 1 passes has produced for any finding. This is now a
majority of the still-open High/Medium findings (8 of 11), not just a spot-check.

### New finding — undirected fuzz sweep (B1-119/B1-120)

An undirected fuzz batch (not tied to any previously-named finding) was run against `HEAD`
`6dbba45` covering: privilege escalation via raw `user_roles` self-insert (admin/moderator/
active-breeder-bypass — all 3 attempts **correctly rejected**, `42501`), anonymous read access to
`legal_holds`/`audit_logs`/`account_deletion_requests`/`user_verifications`/`profiles.email,phone`
(all 5 **correctly rejected at the grant level**, not merely RLS — `anon` has no `SELECT` grant at
all on these tables), cross-tenant reads of exact transport addresses and support cases (correctly
empty-filtered, no error), and `organisation_members` self-promotion to owner of an unaffiliated
org, including by an owner of a *different* real org (both **correctly rejected**, `42501`). All of
this is genuinely solid, evidence-backed "adequate" — the platform's core privilege/tenant boundary
held against every angle tried.

**One new, real, previously-undiscovered High finding did surface**:

| ID | Finding | Severity | Priority | Status | Fixing commit | Verified this pass | Candidate fix |
|---|---|---|---|---|---|---|---|
| NEW-H3 | `achievements.verification_status` owner self-verification | High | P1 | **New this pass, still open** | none | **Live-empirical**: as real `breeder1` (real kennel owner), raw-inserted an achievement row pre-set to `verification_status='approved'` — succeeded, immediately publicly visible (the public SELECT policy requires only `verification_status='approved'` + the org being public/approved, no admin-review gate at all). Probe row deleted immediately after, verified | No |

- **Exact location**: `supabase/migrations/20260101004200_achievements.sql`, policy `"owners manage
  their kennel's achievements"` (`for all using/with check owns_org(kennel_id)`) — no restriction on
  `verification_status` anywhere in the policy, and `select tgname from pg_trigger where tgrelid =
  'public.achievements'::regclass` shows only `set_achievements_updated_at` (a plain timestamp
  stamper), confirmed live — no trigger locks this column the way `20260101014000` now locks
  `fundraising_campaigns.status`.
- **Reachable actor**: any org owner (breeder/foundation/shelter) with at least one `parent_dogs` row
  on file — a normal, unprivileged state for any active kennel.
- **Reproduction**: `supabase.from('achievements').insert({ parent_dog_id, kennel_id, title: 'Best
  in Show', verification_status: 'approved' })` as the kennel's own owner — succeeds.
- **Not reachable through the real app UI**: `src/components/achievement-form-dialog.tsx` never sets
  `verification_status` (confirmed via `grep`, zero matches) — the real form always leaves it at its
  column default (`'pending'`). But `createAchievement()` (`src/lib/queries/breeder.ts`) takes the
  full `Database["public"]["Tables"]["achievements"]["Insert"]` type and passes it straight to a raw
  `.insert(payload)` with no server-side stripping — a raw Data API call (curl/Postman/browser
  devtools) bypasses the UI's own restraint entirely, the identical shape as this report's own §5.2
  finding.
- **Expected invariant**: the same one `fundraising_campaigns_prevent_self_publish()` now enforces
  one table over — a claim that becomes publicly visible as a verified trust signal (here: a
  breeder's award/certification, shown to prospective buyers) must pass through admin review first,
  never be self-declared.
- **Observed behavior**: a kennel can publish a fabricated "verified" achievement/certification
  (e.g., a fake "Best in Show" or health-certification claim) that displays identically to a real,
  admin-reviewed one on the public marketplace — a direct trust/fraud vector for buyers evaluating a
  breeder, matching the rubric's explicit High category "owner self-verification."
  `src/lib/queries/marketplace.ts` (line 687) confirms achievements are surfaced on public breeder
  profile pages without re-checking anything beyond `verification_status`.
- **Smallest fix**: mirror `20260101014000_fundraising_self_publish_lock.sql` exactly — a `before
  insert or update` trigger rejecting any non-admin attempt to set `verification_status = 'approved'`
  (and, for symmetry, `'rejected'`, since an owner shouldn't be able to self-reject their own
  competitor's... n/a here, self-reject their own record either, though lower risk) unless
  `is_admin()`.
- **Regression test**: as a real kennel owner, insert/update an achievement to `verification_status
  = 'approved'` directly (not via any admin RPC, since none exists yet either) and assert rejection;
  an admin performing the same update succeeds.
- **Integration-blocker status**: no — pre-existing, not tied to a frontend integration step.
- **Release-blocker status**: yes, if achievement badges are ever surfaced as a trust signal to real
  buyers before this is fixed.
- **Overlap risk with Bot 2**: moderate — this is exactly the self-approval pattern the codebase has
  now fixed twice elsewhere (`organisations.verification_status`, `fundraising_campaigns.status`)
  without a documented sweep for a third instance; a future Bot 2 self-audit checking "every table
  with a `verification_status`/`admin_status`-shaped column against its owner-facing RLS" would very
  likely find this the same way this fuzz sweep did.
- **Confidence**: confirmed, live-empirical, cleanup verified.

**Second resumption round, `HEAD` `6dbba45`**: 2 more real-repo commits landed since the `8201f17`
checkpoint (`58c1589`/`82e9f73`, Stages FA-4 and a test-hygiene fix), adding 2 more migrations
(144 total). Both read in full: `20260101014200_legal_hold_self_delete_lock.sql` (Stage FA-4) closes
a **real, distinct** legal-hold gap — self-service hard-delete of comments/applications was never
taught about active legal holds — but does **not** touch `legal_holds`' or `account_deletion_
requests`' own RLS/grants (re-confirmed live: both policies and all 13 `authenticated` grants across
the two tables byte-identical to every prior check this pass). §5.2 remains fully open.
`20260101014100_draft_delete_cascade_lock_fix.sql` fixes an unrelated cascade-delete trigger bug, no
bearing on any open finding. Neither migration is a candidate-fix overlap risk for `7ba7b32`.

**Why §5.1/§7.5 were initially misreported in this same pass**: this pass's first round captured the
real-repo snapshot once, at the very start, then did not re-check `main` again until well into the
resumption round — by which point Bot 2 had landed 5 more migrations and ~19 more stage commits
(YR-7 through FA-3) without this pass noticing until a live empirical test (the §5.1 fundraising
exploit attempt) *failed* unexpectedly and forced an investigation that found the newer trigger. This
is direct, first-hand evidence for why the task's own "prefer empirical verification, actually
re-check current state" instruction matters: a second, purely static re-read of the same stale
`26f1b2e` snapshot would never have caught this — only the live exploit attempt against the actual
running instance did.

**Verification-depth note (§7.1/§7.2/§7.3/§7.4/§7.6)**: not independently re-verified this resumption
round either, for time-budget reasons — flagged, not silently carried forward as confirmed.
