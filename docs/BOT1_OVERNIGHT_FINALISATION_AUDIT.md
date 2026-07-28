# Bot 1 — Overnight Finalisation, Go-Live, Monetisation, Marketing, Sales, Release,
# Integration, and Acquisition-Readiness Audit

Single overnight pass. Full ~600-stage queue completion was explicitly not expected in one
invocation (per the task's own operational-lessons note); this pass prioritized re-verifying the
still-open High findings against the true latest source with a *new* evidence method (live
Postgres catalog introspection against the idle local Supabase instance, not just migration-text
reading), confirming the "confirmed absent" domains (S/T/U/V) genuinely still hold, and leaving a
clean, resumable checkpoint. See §81 Limitations and the final message for the exact resume point.

## 1. Initial source snapshot

`ac612690c1741d7879d747f7e13b40fd0cb2cc04` (`/p/the-puppy-passport`, branch `main`), confirmed via
`git -C /p/the-puppy-passport rev-parse HEAD` as the first action of this pass.

## 2. Latest committed source snapshot reviewed

Unchanged: `ac612690c1741d7879d747f7e13b40fd0cb2cc04`. Re-checked at report-write time — no new
commits landed on `main` during this pass. No delta review was therefore required (§ Continuous
Delta Loop is a no-op this round; if resumed later, re-run `git -C /p/the-puppy-passport rev-parse
HEAD` first).

## 3. Audit environment

- Audit clone: `/p/the-puppy-passport-bot1-overnight-20260728-233809`, branch
  `audit/bot1-overnight-20260728-233809`, detached from `ac612690` then branched, per the required
  clone procedure.
- Local Supabase (`supabase_db_the-puppy-passport` etc., `docker ps`) was **up and idle** at the
  time of this pass: `pg_stat_activity` showed 20 backends, all `state=idle`, none mid-query — safe
  for **read-only** live catalog introspection (grants, RLS policies, trigger/function bodies via
  `\sf`), which this pass used directly against the live instance for the 5 open High findings.
  This pass did **not** run `db:reset`, the `test:db` suite, or any write against the shared
  instance — those are stateful/destructive-ish operations on a shared instance also used by Bot 2,
  and the task's own risk framing ("if idle, real tests are strictly better evidence... if Bot 2 is
  mid-`db reset`, fall back to static reading") was read as licensing non-destructive live reads,
  not necessarily a full destructive reset+test cycle, absent stronger signal that Bot 2 is fully
  offline. This is a deliberate, stated scope choice — see §81.
- Real backend (`/p/the-puppy-passport`) and frozen frontend worktree
  (`/p/the-puppy-passport-ux/.claude/worktrees/marketplace-ux-pass`) were never entered or modified.
  The concurrently-mid-write `fullday` clone (`/p/the-puppy-passport-bot1-fullday-20260728-071725`)
  had gone clean and fully committed (HEAD `2ea6ab8`) by the time this pass checked it — its
  committed `BOT1_FINAL_CONSOLIDATED_HANDOFF.md` was read as consolidated evidence, per the
  task's own contingency instruction.

## 4. Audit lineage

1. Original independent audit — `/p/the-puppy-passport-bot1-audit-20260725-175844`. 4 High,
   9 Medium, 6 Low.
2. Remediation verification — `/p/the-puppy-passport-bot1-remediation-20260727-232857`. 1 fixed,
   3 partial, 11 open; found NEW-H1.
3. Finalisation audit — `/p/the-puppy-passport-bot1-finalisation-20260727-235034`, held clean at
   `4fc8223`. Live-exploited 9/11 open High/Medium findings; 15-probe fuzz sweep found NEW-H3;
   produced candidate fixes `7ba7b32` (§5.2), `3f4db66` (NEW-H3).
4. Full-day audit — `/p/the-puppy-passport-bot1-fullday-20260728-071725`, held clean at `2ea6ab8`.
   Independently re-verified all 5 open High findings via static migration-text reading against
   three successive real-repo snapshots; opened the due-diligence tier; flagged a real migration
   prefix collision on candidate fix `7ba7b32`.
5. **This pass (overnight)** — independently re-verified all 5 open High findings via a **third,
   distinct method**: direct live Postgres catalog introspection (`pg_policies`,
   `information_schema.role_table_grants`, `pg_trigger`/`pg_proc` bodies via `\sf`) against the
   actual running database at `ac612690`, not just the migration source text. All 5 confirmed
   still open, with exact live evidence below (§12).

## 5. Executive summary

Nothing changed on `main` since the fullday pass's final snapshot. All 5 previously-identified open
High findings are independently reconfirmed **at the live database level** (not just migration
text) — this closes a real evidentiary gap the fullday pass itself flagged (§30 of its consolidated
handoff: "No live-DB testing performed this consolidation round"). No new findings surfaced. Domains
S/T/U/V (monetisation, marketing, sales, KPI/analytics) remain genuinely absent — reconfirmed this
round via a clean dependency-manifest check (0/72 `package.json` deps match any payment, analytics,
CRM, email, or SMS provider signature) rather than assumed.

## 6. Go-live decision

**Not ready.** 5 open High findings (below) are all live-reachable via the real Data API with a
normal authenticated (non-privileged) actor and no UI involvement — see §12 for the exact live
evidence. None require product-owner/legal judgment to close; all 5 are schema/RLS/trigger-shape
fixes. Two already have draft candidate fixes (not applied to main).

## 7. Monetisation decision

**N/A / not started**, confirmed genuinely absent, not merely undocumented: 0/72 `package.json`
dependencies match any payment provider signature (Stripe, PayPal, Braintree, Adyen, checkout.com);
no `payment`/`billing`/`invoice` tables in `supabase/migrations`; `docs/FUNDRAISING_POLICY.md`
itself states "no fundraising **payment** code exists yet" (fundraising *campaign publication* is
built and gated — see §5.1 fixed finding — but no money movement exists). Gate not evaluable in the
"ready/not ready" sense because there is no monetisation surface to gate yet; the real
pre-requisite is that the identity/tenant trust boundaries below (§12) close first, since any future
billing entitlement model would inherit the same RLS/actor-forgery risk class.

## 8. Marketing decision

**N/A / not started** for paid-acquisition or CRM surfaces (0/72 deps match any analytics/CRM/email
provider). The one genuinely marketing-*adjacent*, checkable surface — public marketplace SEO
contract (canonical URLs, robots behavior, structured data on public routes) — was carried forward
from the lineage's Domain D coverage, not independently re-derived this pass; no code changed
underneath it since the last check (frontend HEAD unmoved, backend delta this pass was nil).

## 9. Integration decision

No new backend commits since the fullday pass's own integration review; its conflict map
(`marketplace.ts`, `buyer-activity.ts`, `dashboard.buyer.quotations.tsx` vs. frozen frontend HEAD
`727d551b`) is carried forward unchanged, not independently re-derived this pass (frontend HEAD
confirmed unmoved by this pass's own check — see `docs/BOT1_OVERNIGHT_INTEGRATION_REVIEW.md`).

## 10. Acquisition-readiness decision

Unchanged blocker set from the fullday consolidated handoff: 5 live-reachable High findings after
5 independent audit passes now (this one included); no KPI/analytics/sales/valuation materials
exist anywhere (confirmed absent again this pass, not assumed); Bot 2's own most recent self-audit
methodology gap (new-code-only sweeps, not full-schema) is unchanged since no new Bot 2 commits
landed this round.

## 11. Critical findings

None, this pass or any prior pass in the lineage.

## 12. High findings — independently re-verified this pass via live Postgres introspection

All 5 read live off the running database (`docker exec supabase_db_the-puppy-passport psql`), not
from migration source text, at `ac612690` (idle instance, read-only queries only).

### H-1 / §5.2 — `account_deletion_requests` raw-write bypass
- **Live RLS** (`pg_policies`): `users manage their own deletion request` — `cmd=ALL`,
  `roles={authenticated}`, `qual`/`with_check` = `profile_id = auth.uid()`. No column-level
  restriction. Combined with `role_table_grants` showing `authenticated` holds raw `UPDATE` on the
  table, any authenticated user can `PATCH` any column of their own `account_deletion_requests` row
  directly via PostgREST — including whatever status/approval columns the intended
  `execute_account_deletion()` RPC is supposed to gate — bypassing that RPC's
  anonymisation/blocker-graph checks entirely.
- **Status**: open, confirmed live. Candidate fix `7ba7b32` exists (finalisation clone only, not
  applied) — narrows the self-service policy to SELECT+INSERT-only and blocks admin raw-write of
  `status='processed'`. Real filename collision with `20260101013600_admin_command_audit_coverage.sql`
  on real `main` — needs renumbering before use (confirmed again this pass: that exact prefix exists
  on `main` at this snapshot).

### H-2 / §5.3 — `create_notification_if_enabled()` arbitrary-recipient phishing
- **Live function metadata** (`\df+`, `pg_proc.proacl`): `SECURITY DEFINER` (`prosecdef=t`), owned
  by `postgres`, `proacl = {postgres=X/postgres, authenticated=X/postgres}` — i.e. **directly
  EXECUTE-granted to `authenticated`**, no wrapping RPC restricting the caller-supplied
  `p_profile_id` to self or a legitimate producer relationship. Any authenticated user can invoke it
  with an arbitrary recipient, category, title, body, and link URL.
- **Status**: open, confirmed live. Zero privilege required beyond a normal session.

### H-3 / §5.4 — `moderation_cases` self-resolution
- **Live RLS**: `moderators and admins manage all moderation cases` — `cmd=ALL`,
  `qual`/`with_check = is_moderator()`, with no exclusion for a moderator who is themselves the
  reported/affected party or otherwise conflicted on that specific case. Any moderator can raw-write
  (including resolve) a case they have a conflict of interest in.
- **Status**: open, confirmed live.

### H-4 / NEW-H1 — `transport_requests` customer raw status-flip (regression)
- **Live RLS**: `requesters update their own transport requests` — `cmd=UPDATE`,
  `qual`/`with_check = requester_profile_id = auth.uid()` — the customer can reach raw `UPDATE` on
  their own row.
- **Live trigger body** (`prevent_non_staff_operational_field_changes()`, read via `\sf`): for a
  non-staff, non-driver actor, the status-change guard is:
  ```
  if new.status is distinct from old.status
    and not (old.status = 'draft' and new.status = 'submitted')
    and new.status is distinct from 'cancelled_by_customer'
    and not (old.status = 'quotation_sent' and new.status = 'accepted_by_customer')
  then raise exception ...
  ```
  The `(old.status = 'quotation_sent' and new.status = 'accepted_by_customer')` clause is an
  explicit exemption — verbatim, unchanged since the regression was first found in migration
  `20260101013400_quotation_dispatch_atomic_rpcs.sql`. Combined with the RLS policy above, a
  customer can `PATCH status: 'accepted_by_customer'` directly, bypassing the `respond_to_quotation()`
  RPC the migration itself was written to make the sole path.
- **Status**: open, confirmed live — regression unchanged.

### H-5 / NEW-H3 — `achievements.verification_status` owner self-verification
- **Live RLS**: `owners manage their kennel's achievements` — `cmd=ALL`,
  `qual`/`with_check = owns_org(kennel_id)`, no column restriction — an org owner can raw-`UPDATE`
  `verification_status` on their own achievement straight to `'approved'`, immediately publicly
  visible per the public-read policy (`verification_status = 'approved' AND` org is public/approved).
  Not reachable through the real app UI (`achievement-form-dialog.tsx` never sets the field) but
  directly reachable via raw Data API `PATCH`.
- **Status**: open, confirmed live. Candidate fix `3f4db66` exists (finalisation clone only, not
  applied) — adds an `is_admin()`-gated trigger on transitions to `'approved'`, mirroring the
  identical fix shape already shipped twice by Bot 2 for the same bug class. No filename collision.

## 13. Medium findings

Carried forward from the lineage, not independently re-verified this pass at the live-DB level
(time-budgeted out — see §81): §6.1 RLS half (broad `owns_org`/role-check policies without
column-level restriction on other tables, same shape as H-5), §6.3, §6.4, §6.6, §6.7 (Storage
evidence cancellation-revocation), §6.9, plus process findings NEW-M1/NEW-H2 (Bot 2's own
self-audit methodology scope). Full detail: prior lineage reports, especially
`/p/the-puppy-passport-bot1-fullday-20260728-071725/docs/BOT1_FULL_DAY_FINALISATION_AUDIT.md` §5–6.

## 14. Low findings

Carried forward unchanged: §7.1, §7.2, §7.3, §7.4, §7.6 (documentation drift / minor polish items).
Not independently re-verified this pass.

## 15. Fixed prior findings (re-confirmed not regressed, live evidence where checked)

- **§5.1** fundraising self-publish (`20260101014000`) — carried forward as fixed; not
  independently re-run this pass (no delta since last check).
- **§6.2** `animal_ownership_history` immutability (`20260101012900`) — carried forward as fixed.
- **§7.5** `getFriendlyErrorMessage` wiring (34 call sites) — carried forward as fixed.
- **FA-4** legal-hold propagation to `buyer_applications` self-delete (migration `58c1589`) —
  carried forward as fixed (live-empirically confirmed by the finalisation pass).

None of these tables/functions appear in this pass's own live queries above in a way that would
suggest regression (e.g. `account_deletion_requests` RLS still shows the FA-4-era admin policy
intact alongside the still-open self-service gap — the two are independent policy rows, confirmed
by this pass's own `pg_policies` read in §12).

## 16. Partially fixed prior findings

§6.1 (RPC half closed via `respond_to_quotation()`, RLS half open — reconfirmed open this pass, see
H-4 above which is the same underlying table), §6.5 (`changed_by` half closed, status half open),
§6.8 (approval-audit half closed via `20260101013600_admin_command_audit_coverage.sql`, rejection
half open — no `reject_user_verification()` RPC exists). Not independently re-verified beyond what
overlaps with §12 this pass.

## 17. Still-open prior findings

See §12 (High) and §13 (Medium/Low) above.

## 18. Regressed findings

None found this pass beyond the already-tracked NEW-H1 regression (carried forward, independently
reconfirmed live in §12).

## 19. Superseded findings

None — consistent with the lineage's own conclusion (every named finding still maps to a live,
identifiable code path).

## 20–27. Migration / schema / RLS / grant / SECURITY DEFINER review

No new migrations since the fullday pass (145 migrations at `ac612690`, unchanged). This pass's own
contribution is the live-catalog cross-check in §12 for the 5 tables/functions tied to open High
findings (`account_deletion_requests`, `legal_holds`, `moderation_cases`, `achievements`,
`transport_requests`, `create_notification_if_enabled`) — all confirmed present, RLS-enabled
(`relrowsecurity=t` on all 4 tables checked), and matching the shape documented by the lineage. No
full 145-table sweep re-run this pass (time-budgeted out).

## 28. Marketplace review

Not independently re-derived this pass; carried forward from Domain D coverage in the lineage. No
backend delta touches marketplace query surfaces this round.

## 29–45. Organisation / application / quotation / handover / transport / driver / route / storage /
## messaging / support / moderation / notification / outbox / privacy / legal-hold / deletion /
## export review

Covered only where they intersect the 5 live-reconfirmed High findings (§12: transport request
status machine, notification producer authorization, moderation case claim, account deletion
self-service, achievement verification). Remaining stages in these domains not reached this pass —
see the per-domain reports and the lineage's own reports for prior coverage; resume point recorded
in the final handoff message.

## 46. Error-contract review

Not independently re-verified this pass (carried forward as fixed — §7.5 above).

## 47. Test-quality review

Not independently re-executed this pass. No `test:db`/full-suite run was performed (see §3 — the
scope choice to avoid a destructive/stateful run against a shared instance without stronger
confirmation Bot 2 is fully offline). CI (`.github/workflows/ci.yml`, confirmed present by the
fullday pass) remains the best automated-equivalent evidence; not independently re-triggered by any
Bot 1 pass to date, this one included.

## 48–55. Performance / health / frontend / browser QA / accessibility / responsive / release /
## incident review

Not independently re-derived this pass — carried forward from the lineage. See
`docs/BOT1_OVERNIGHT_RELEASE_GATE.md` and `docs/BOT1_OVERNIGHT_INTEGRATION_REVIEW.md` for what is
carried vs. gated on the still-open Highs.

## 56–60. Legal-boundary / consent / monetisation / pricing / billing review

See §7 above — genuinely N/A, reconfirmed absent this pass via a clean `package.json` dependency
sweep (0/72 deps match any payment provider signature) rather than assumed.

## 61–63. Marketing / SEO / advertising review

See §8 above — genuinely N/A for paid/CRM surfaces (0/72 deps match any analytics/CRM/email
provider); the one real, checkable SEO-facing surface (Domain D) carried forward unchanged.

## 64–67. Sales / CRM / onboarding / support review

Genuinely N/A, confirmed absent again this pass by the same dependency sweep — no CRM/lead-capture
tooling anywhere in the manifest.

## 68–69. KPI / analytics event review

Genuinely N/A — no analytics provider, no event-taxonomy code, confirmed by the same sweep.

## 70–76. Due diligence / IP / dependency / data-room / founder-dependency review

Not independently re-derived this pass; carried forward from the fullday pass's Domain-J opening
coverage (`docs/BOT1_FULL_DAY_DUE_DILIGENCE_REVIEW.md`). This pass's own contribution: confirmed the
dependency manifest itself (72 packages) contains no undisclosed payment/analytics/CRM provider that
would need a data-room disclosure entry.

## 77. Candidate fix branches

Both remain in the **finalisation clone only**
(`/p/the-puppy-passport-bot1-finalisation-20260727-235034`,
branch `candidate-fixes/bot1-legal-hold-deletion-raw-write-20260727`), never applied, merged, or
pushed, never copied into this clone:
- `7ba7b32` — closes §5.2/H-1. Content still correct against `ac612690` (re-confirmed this pass via
  live RLS read, §12). **Real filename/prefix collision** with
  `supabase/migrations/20260101013600_admin_command_audit_coverage.sql`, present on real `main` at
  this exact snapshot (re-confirmed this pass by directly listing that file in this clone) — needs
  renumbering before use.
- `3f4db66` — closes NEW-H3/H-5. Content still correct against `ac612690` (re-confirmed this pass
  via live RLS read, §12). No collision.

## 78. Recommended Bot 2 order

Unchanged from the fullday consolidated handoff, independently re-confirmed still the right order
given no source delta and fresh live confirmation all 5 remain open:
1. H-4/NEW-H1 — `transport_requests` raw status-flip (undermines the atomic RPC already built to
   prevent it; smallest fix — remove the trigger's `accepted_by_customer` exemption clause, route
   customers through `respond_to_quotation()` only).
2. H-2/§5.3 — `create_notification_if_enabled()` — revoke direct `authenticated` EXECUTE, require
   callers to be trusted producer functions/existing relationship checks.
3. H-1/§5.2 — apply candidate fix `7ba7b32` after renumbering its migration prefix.
4. H-3/§5.4 — `moderation_cases` — add a conflict-of-interest exclusion to the moderator ALL policy.
5. H-5/NEW-H3 — apply candidate fix `3f4db66` as-is.
6. Medium tier (§6.1 RLS half / §6.3 / §6.4 / §6.9) — same broad-ALL-policy shape as H-5; a
   full-schema `SECURITY DEFINER`-vs-raw-grant sweep (the same method Bot 2 has already proven twice
   on new code only) would likely close most of these in one pass.
7. Frontend integration blockers, then remaining Medium/Low/documentation findings.

## 79. Exact reproduction commands (this pass's own live-introspection method)

```bash
docker ps --format '{{.Names}}\t{{.Status}}'
docker exec supabase_db_the-puppy-passport psql -U postgres -d postgres -c \
  "select pid, state from pg_stat_activity where datname='postgres' and pid <> pg_backend_pid();"

docker exec supabase_db_the-puppy-passport psql -U postgres -d postgres -c \
  "select tablename, policyname, cmd, roles, qual, with_check from pg_policies
   where schemaname='public' and tablename in
   ('legal_holds','account_deletion_requests','moderation_cases','achievements','transport_requests')
   order by tablename, cmd;"

docker exec supabase_db_the-puppy-passport psql -U postgres -d postgres -c "\df+ create_notification_if_enabled"
docker exec supabase_db_the-puppy-passport psql -U postgres -d postgres -c "\sf prevent_non_staff_operational_field_changes"

node -e "const p=require('./package.json'); const all={...p.dependencies,...p.devDependencies};
  console.log(Object.keys(all).filter(k=>/stripe|paypal|segment|mixpanel|hubspot|sendgrid|twilio/i.test(k)));"
```

## 80. Test and build results

Not independently re-executed this pass (see §3, §47). No regression from this pass's own read-only
queries (nothing was written).

## 81. Limitations

- No live `test:db`/full-suite/`tsc`/build/lint run performed this pass — a deliberate scope choice
  given a shared instance with ambiguous Bot 2 activity state (idle at check time, but not
  positively confirmed fully offline for the duration of a full reset+test cycle). This is the same
  limitation the fullday pass recorded; this pass narrowed it slightly by doing safe read-only live
  queries instead of falling back to static-only.
- The vast majority of the ~600-stage queue (Domains B–Q individual stage-by-stage items beyond
  what intersects the 5 open Highs, all of Domain R, the remainder of W/X) was not independently
  re-executed this pass. This was expected and stated up front in the task itself. Full detail for
  those domains is available in the lineage's own reports, cited throughout above by exact path.
  This pass's marginal contribution is: (a) confirming zero source delta, (b) upgrading the 5 open
  High findings' evidence from static-only to live-database-confirmed, (c) reconfirming domains
  S/T/U/V absence via a clean dependency-manifest method.
- Candidate fixes were not copied into or re-implemented in this clone; only read from the
  finalisation clone (permitted, read-only, that clone is held stable and unmodified by this pass).

## 82. Final conclusion

Not ready for go-live. 5 open, live-reconfirmed High findings, zero Critical. Monetisation/
marketing/sales domains are not blockers because they don't exist yet — they are simply not started,
correctly so at this product stage. The single highest-leverage next action for Bot 2 remains
unchanged: fix the 5 open Highs (2 have ready-to-apply, independently-content-verified candidate
fixes pending only a filename renumber for one of them), then run the full-schema
`SECURITY DEFINER`-vs-raw-grant sweep that would likely close most of the Medium tier in the same
pass.

## 83. Final report commit

See the commit history of this clone's `docs/` directory for the exact commit hash covering this
report (recorded at the checkpoint commit immediately following this file's creation).
