# Bot 1 — Independent Adversarial Backend Audit

Read-only, evidence-based audit of the Havenpaw backend (`supabase/migrations/*.sql`, `tests/db/*`,
and the frontend integration contract) performed in an isolated clone. No application code,
migration, or test file was modified. Nothing here was invented — every finding cites the exact
file/line evidence used to confirm it, and cross-checks the *current, final* state after all 118
migrations apply in order (a bug introduced by migration N and fixed by migration M>N is reported as
fixed, not flagged as live, unless verification showed otherwise).

## 1. Snapshot and environment

- **Source repo**: `/p/the-puppy-passport` (main worktree, never entered or modified).
- **Source snapshot (`main` HEAD at clone time)**: `e6270a04e5b1598c48bdeb37ac371afafea1fbff`
  ("Fill in Stage CJL commit hash in progress log", 2026-07-25T02:22:48+02:00).
- **Audit clone**: `/p/the-puppy-passport-bot1-audit-20260725-080809` (`--no-hardlinks`, fully
  independent working tree and object store).
- **Audit branch**: `audit/bot1-backend-20260725-080815`, branched from a detached checkout of the
  snapshot above.
- **Frontend reference**: `origin/ux-marketplace-frontend-pass` @ `727d551b8306cf6bd5ce8a2b542ac118b1c4f417`
  (matches the frozen frontend handoff exactly), inspected read-only via `git show`/`git diff`,
  never checked out.
- **Method**: static code/schema review — grep-driven extraction across all 118 migrations
  (function/policy/grant inventories), targeted full-file reads for every suspicious pattern found,
  cross-referencing the backend's own `docs/*.md` progress/audit trail against the actual current
  migration state (never trusted at face value — every claim in those docs that mattered to a
  finding was independently re-verified against the SQL). No `supabase db reset`/`test:db` run (no
  local Supabase instance available in this environment; this is a static audit, not a runtime one —
  see Limitations).

## 2. Executive summary

This backend has already been through an unusually long, unusually rigorous self-hardening session
(~50+ documented real fixes across two supplemental queues, 490+ passing `test:db` tests at various
checkpoints, systematic sweeps for forgeable-actor-id bugs, self-approval bugs, and concurrency
races — all independently spot-verified below and found accurate where checked). RLS coverage,
`SECURITY DEFINER` `search_path` pinning, secret hygiene, and driver/suspension access control are
all genuinely clean across the board — no gaps found in any of those categories.

Despite that, this independent pass found **one HIGH-severity state-machine-skip bug** (fundraising
campaigns can self-publish to the public site bypassing admin approval, confirmed against the
project's own authoritative policy doc), **one MEDIUM-HIGH concurrency/state-integrity bug**
(quotations have no terminal-state guard — a requester can reopen or flip an already-decided
quotation indefinitely, including expired/superseded ones), **one MEDIUM audit-integrity gap**
(`animal_ownership_history` is admin-mutable via `FOR ALL`, unlike its sibling
`transport_status_history` which was explicitly hardened against exactly this), and — the most
concrete, previously-undocumented finding — **real, confirmed post-divergence file-level
co-modification between this backend session and the frozen frontend branch** on
`dashboard.buyer.transport.tsx`, `src/lib/queries/marketplace.ts`, and
`src/lib/queries/buyer-activity.ts`, which directly contradicts the frontend's own
`FRONTEND_MERGE_CONFLICT_PLAN.md` claim that conflict risk "remains low" and that the file lists
"still don't overlap." Naively applying that document's own stated resolution rule ("frontend wins
on any textual conflict" for `dashboard.buyer.*`) to `dashboard.buyer.transport.tsx` specifically
would silently delete a real backend feature (the customer-facing transport timeline).

No committed secrets, no service-role-in-browser exposure, no missing RLS on any of the 70 tables,
no missing `search_path` pin on any of the 90 `SECURITY DEFINER` functions.

## 3. Integration blockers

| # | Finding | Why it blocks |
|---|---|---|
| 1 | Fundraising campaign self-publish (§4.1) | Must be fixed before `FUNDRAISING_ENABLED` is ever turned on in any environment reachable by real users — the RLS gap exists today regardless of the frontend flag, which is UI-only. |
| 2 | `dashboard.buyer.transport.tsx` / `marketplace.ts` / `buyer-activity.ts` real co-modification (§15) | The documented cherry-pick integration plan will not apply cleanly to these three files, and the frontend's own stated conflict-resolution default ("frontend wins") is actively wrong for `dashboard.buyer.transport.tsx` — following it as written would delete a real, tested backend feature. Must be resolved with a manual combined read, not the default rule, before/during integration. |

Findings §4.2 (quotation terminal-state) and §4.3 (`animal_ownership_history`) are real but not
integration-blockers in the strict sense (they don't prevent a safe cherry-pick/merge) — they are
pre-existing backend gaps independent of the frontend integration.

## 4. Critical findings

None found at Critical severity. The one HIGH finding is listed in §5 rather than here because,
while it is a genuine, confirmed, currently-reachable RLS gap, its blast radius is currently bounded
(no real payment processing exists yet — the file's own header comment confirms "nothing here claims
a real payment has moved money") and the feature is not live in production.

## 5. High findings

### 5.1 — Fundraising campaigns can be self-published by the organisation, bypassing admin approval

- **Severity**: High.
- **Exact location**: `supabase/migrations/20260101005600_fundraising.sql` policy
  `"eligible org owners update their own non-terminal campaigns"` on
  `public.fundraising_campaigns`, as last redefined by
  `supabase/migrations/20260101009100_fundraising_outcome_status_lock.sql` (the current, final
  version — confirmed no later migration touches this policy).
- **Reachable actor**: any authenticated user who owns an organisation eligible for fundraising
  (`is_eligible_fundraising_org()` — foundation/shelter/rescue/kennel_club, not kennels or
  transport companies) and who has a `fundraising_campaigns` row they own in any non-terminal
  status.
- **Reproduction path**: as that org owner, via a normal PostgREST/`supabase-js` call —
  `supabase.from('fundraising_campaigns').update({ status: 'active' }).eq('id', campaignId)` —
  on a campaign currently in `'draft'` or `'organisation_review'`. The `USING` clause only checks
  `status not in ('completed', 'refund_review')` (true for draft/organisation_review), and the
  `WITH CHECK` clause's allowed-status list includes `'active'` directly alongside
  `'draft'`/`'organisation_review'`, with no requirement that the *old* status be `'approved'`.
- **Expected invariant**: `docs/FUNDRAISING_POLICY.md` §"Campaign states" (line 82), the
  authoritative policy document, states explicitly: `` `draft` → `organisation_review` → `approved`
  → `active` → (...) `` — `approved` (admin-only, correctly excluded from the org-settable list)
  must precede `active`.
- **Observed behavior**: the org-owner UPDATE policy's `WITH CHECK` list is
  `('draft', 'organisation_review', 'active', 'expired', 'transport_cancelled')` — `'active'` is
  reachable directly from `'draft'`/`'organisation_review'` with no transition-order enforcement
  (no trigger checks `OLD.status`). The campaign becomes publicly visible immediately
  (`"public reads active fundraising campaigns"` includes `status = 'active'`), with its title,
  description, and target amount shown to anonymous visitors — never reviewed by an admin.
- **Smallest recommended fix**: add `'active'` to the admin-only side of the line, matching the
  fix already applied to `target_reached`/`partially_funded` in `20260101009100`:
  ```sql
  drop policy "eligible org owners update their own non-terminal campaigns" on public.fundraising_campaigns;
  create policy "eligible org owners update their own non-terminal campaigns"
    on public.fundraising_campaigns for update to authenticated
    using (public.owns_org(organisation_id) and status not in ('completed', 'refund_review'))
    with check (
      public.owns_org(organisation_id)
      and public.is_eligible_fundraising_org(organisation_id)
      and public.fundraising_campaign_links_are_valid(organisation_id, animal_id, buyer_application_id, transport_request_id, quotation_id)
      and status in ('draft', 'organisation_review', 'expired', 'transport_cancelled')
    );
  ```
- **Regression test**: extend `tests/db/fundraising.test.ts` (already has the equivalent test for
  `target_reached`/`partially_funded`, per the Stage AA changelog entry) with: an org owner attempts
  `update ... set status = 'active'` on their own `draft`/`organisation_review` campaign and is
  rejected; an admin performing the same update succeeds.
- **Integration-blocker status**: yes — see §3.
- **Overlap risk with Bot 2**: moderate-high. This is a classic RLS self-approval pattern the
  backend session itself has repeatedly found and fixed elsewhere (`rehoming_reviews`,
  `buyer_applications`) — a second adversarial pass auditing RLS status-transition policies would
  plausibly find this by the same pattern-matching, especially since the sibling
  `target_reached`/`partially_funded` fix in the same file is a strong hint.

## 6. Medium findings

### 6.1 — Quotations have no terminal-state or expiry guard on the requester's own update policy

- **Severity**: Medium-High.
- **Exact location**: `supabase/migrations/20260101001500_quotations.sql` policy
  `"requesters accept or reject their own quotation"` on `public.quotations` (confirmed unmodified
  by any later migration — `20260101008400_quotation_requester_field_lock.sql` adds a
  column-scoping trigger but explicitly excludes `status` from its comparison, so it does not
  narrow this gap).
- **Reachable actor**: any authenticated requester on a transport request with a quotation in any
  status.
- **Reproduction path**: `supabase.from('quotations').update({ status: 'rejected' }).eq('id', quotationId)`
  after having already `.update({ status: 'accepted' })`'d the same row earlier — succeeds, no
  error. Equally, a quotation already `'expired'` or `'replaced'` (superseded by a newer quotation
  from ops) can be flipped back to `'accepted'` by the requester at any later time — the `USING`
  clause never inspects `OLD.status` at all, only row ownership.
- **Expected invariant**: an accept/reject decision on a quotation should be a one-way, terminal
  action (matches every other decision-state pattern in this schema — `buyer_applications`,
  `moderation_appeals`, `user_verifications` all guard against re-deciding an already-decided row);
  an expired or replaced quotation should never become acceptable again.
- **Observed behavior**: `status` is freely toggleable between `'accepted'`/`'rejected'` regardless
  of the row's current status, by the requester, indefinitely.
- **Smallest recommended fix**: narrow the `USING` clause to require the current status be
  pre-decision:
  ```sql
  using (
    status in ('sent', 'viewed')
    and exists (select 1 from public.transport_requests tr where tr.id = transport_request_id and tr.requester_profile_id = (select auth.uid()))
  )
  ```
- **Regression test**: a new case in the quotation-lifecycle coverage (or extend
  `tests/db/pricing-and-quotation-security.test.ts`): accept a quotation, then attempt to reject it
  — expect rejection; attempt to accept an `'expired'`/`'replaced'` quotation — expect rejection.
- **Integration-blocker status**: no — independent of frontend integration.
- **Overlap risk with Bot 2**: moderate. Requires reading the actual `USING`/`WITH CHECK` text
  rather than trusting the "column-locked in Stage L" claim repeated in the backend's own progress
  notes at face value — a second auditor who stops at that claim (rather than re-reading the current
  policy text) would miss this, since the column-lock fix is real and does close a *different*,
  adjacent gap (price manipulation) on the same policy.

### 6.2 — `animal_ownership_history` is admin-mutable (`FOR ALL`), unlike its sibling audit-trail table

- **Severity**: Medium.
- **Exact location**: `supabase/migrations/20260101000900_animals.sql`, policy
  `"admins manage all ownership history"` on `public.animal_ownership_history`. No later migration
  touches this table (confirmed: only `20260101000900` and the blanket-grant migration
  `20260101002900_table_grants.sql` reference it).
- **Reachable actor**: any user with the `admin` role.
- **Reproduction path**: `supabase.from('animal_ownership_history').delete().eq('id', historyRowId)`
  or `.update({ owner_profile_id: forgedId })` as an admin session — both succeed; RLS permits it
  (`FOR ALL`) and the table-level grant includes `update, delete` for `authenticated`
  (`20260101002900_table_grants.sql`).
- **Expected invariant**: this table exists specifically to be provenance/history data — the
  project has an established, explicit precedent for exactly this table shape:
  `transport_status_history` had the identical `FOR ALL` gap (for both ops staff and assigned
  drivers) and was deliberately locked to `SELECT`+`INSERT`-only for everyone, including admins, in
  `supabase/migrations/20260101011300_immutable_status_history.sql`, whose own comment states the
  reasoning verbatim: *"A genuine future correction need would go through direct database access
  (service role), never the app's normal RLS path."* `animal_ownership_history` was never given the
  same treatment.
- **Observed behavior**: an admin (via RLS) and, at the grant layer, any `authenticated` role
  (blocked only by the currently-permissive RLS, not by the grant) can rewrite or delete
  animal-provenance history rows with no separate audit trail requirement.
- **Smallest recommended fix**: apply the exact same pattern as `20260101011300`:
  ```sql
  drop policy "admins manage all ownership history" on public.animal_ownership_history;
  create policy "admins view all ownership history" on public.animal_ownership_history for select to authenticated using (public.is_admin());
  create policy "admins log ownership history" on public.animal_ownership_history for insert to authenticated with check (public.is_admin());
  revoke update, delete on public.animal_ownership_history from authenticated;
  ```
  (Note: `docs/TECH_DEBT_REGISTER.md` already documents that nothing in `src/` currently writes to
  this table at all — "no real 'ownership transfer' business action" — so this fix has zero effect
  on any real code path today, the same "audited, real, unreachable via the UI, real via raw API"
  shape as most of this backend session's own fixes.)
- **Regression test**: a new `tests/db/` case: an admin attempts `update`/`delete` on an
  `animal_ownership_history` row and is rejected; `select`/`insert` still succeed.
- **Integration-blocker status**: no.
- **Overlap risk with Bot 2**: low-moderate — requires noticing the asymmetry between two
  structurally-identical tables' final states across 118 migrations, not just auditing each table in
  isolation.

### 6.3 — Blanket table-level `UPDATE`/`DELETE` grants on append-only-by-design tables

- **Severity**: Medium (defense-in-depth, not currently exploitable given §6.2's RLS state once
  fixed, and already inert for `audit_logs`/`transport_status_history`/`rate_limit_events`).
- **Exact location**: `supabase/migrations/20260101002900_table_grants.sql` — the single blanket
  `grant select, insert, update, delete on ... to authenticated` statement covering (among 20+
  other, legitimately-mutable tables) `audit_logs`, `animal_ownership_history`,
  `transport_status_history`.
- **Reachable actor**: not directly exploitable by itself (RLS is the actual gate for `audit_logs`
  and, post-§6.2-fix, `animal_ownership_history` and `transport_status_history` too) — but it is
  unnecessary attack surface: a future migration that accidentally adds a permissive UPDATE/DELETE
  policy to any of these tables (exactly the class of mistake `transport_status_history` itself
  once had) would be silently exploitable immediately, with no second grant-layer barrier to catch
  it.
- **Expected invariant**: least-privilege — an append-only table's table-level grants should match
  its intended shape (`select, insert` only), so a future RLS mistake is contained rather than
  immediately live.
- **Observed behavior**: `update, delete` are granted table-wide regardless of each table's actual
  intended mutability.
- **Smallest recommended fix**: `revoke update, delete on public.audit_logs, public.animal_ownership_history, public.rate_limit_events from authenticated;` (mirrors the belt-and-suspenders revoke `20260101011300` already did for `transport_status_history`, and matches its own explicit stated reasoning for doing so).
- **Regression test**: none needed beyond §6.2's (this is a hygiene fix, not a behavior change —
  RLS already fully governs the reachable behavior either way).
- **Integration-blocker status**: no.
- **Overlap risk with Bot 2**: low — a hygiene/defense-in-depth observation, easy to overlook since
  it's not independently exploitable today.

## 7. Low findings

### 7.1 — `rate_limit_events` rows for an action never repeated by the same actor are never pruned

- **Severity**: Low (documented, deliberate tradeoff by the backend session itself — see
  `20260101010900_rate_limit_events_archival.sql`'s own comment).
- **Detail**: `enforce_rate_limit()` prunes a caller's own stale rows only as a side effect of that
  same caller hitting the same `action_key` again. A one-time action (e.g. a single report
  submission) that a user never repeats leaves its `rate_limit_events` row permanently. Unbounded
  but slow growth; genuinely low real-world impact given typical action volumes, and the table has
  no RLS/security consequence either way (admin-only SELECT, no client write path).
- **Recommended fix**: not urgent; a scheduled cleanup job would be the natural fix once one exists
  for any other reason (none exists in this codebase today, correctly not built just for this per
  the codebase's own stated discipline).
- **Integration-blocker status**: no.

### 7.2 — `public` schema `CREATE` privilege revocation not explicit in migrations

- **Severity**: Low / informational.
- **Detail**: no migration contains `revoke create on schema public from public/anon/authenticated`
  or an equivalent explicit hardening statement. Every `SECURITY DEFINER` function correctly pins
  `search_path = public` (verified, see §10), which is safe *as long as* the `public` schema itself
  is not writable by a lower-privilege role (otherwise a malicious `authenticated` user could create
  an object in `public` that shadows an unqualified bare-name reference inside a definer function —
  none were found; every table reference checked was schema-qualified `public.<table>`, which is
  itself a strong mitigation independent of this point). Recent Supabase-provisioned projects
  default to `CREATE` already revoked from `PUBLIC` on new projects, but this is a platform default,
  not something these migrations assert or verify.
- **Recommended fix**: add an explicit `revoke create on schema public from public;` migration (or
  document, in `docs/PRODUCTION_SETUP.md`, that this must be manually verified against the actual
  provisioned project before launch — the same treatment already given to `api.max_rows` in that
  same doc).
- **Integration-blocker status**: no.

### 7.3 — `Date.now()`-suffixed uniqueness in test fixtures (17 files)

- **Severity**: Low.
- **Detail**: `grep -rl "Date.now()" tests/db/*.test.ts` returns 17 files, mostly for generating
  unique test emails/action keys within a single test run. The one previously-identified real
  collision risk (`request_number` generation) was already fixed session-wide via
  `createTestTransportRequest()` in `tests/db/helpers.ts` (confirmed present, 181 lines). The
  remaining 17 files' usage is lower-risk (millisecond-granularity email/key suffixes, not
  concurrently-generated within the same test), but if `test:db` files are ever run with genuine
  cross-file parallelism (not confirmed either way from static reading), two different files
  hitting `Date.now()` in the same millisecond could theoretically collide on an `action_key`.
- **Recommended fix**: none urgent; if adopted, the same `timestamp + random suffix` pattern
  `createTestTransportRequest()` already uses would close the remaining theoretical gap.
- **Integration-blocker status**: no.

## 8. Areas verified adequate (with evidence)

- **RLS coverage**: all 70 tables created in this schema have a matching
  `alter table ... enable row level security` statement — cross-checked table-name-for-table-name,
  zero gaps (`.audit-temp/all_tables.txt` vs `.audit-temp/rls_enabled_tables.txt`, both removed
  before commit per instructions, counts and diff recorded here: 70/70, `diff` empty).
- **`SECURITY DEFINER` `search_path` pinning**: all 90 `SECURITY DEFINER` functions found across
  every migration have `set search_path = public` in the same statement — zero missing (script-
  extracted, see §10).
- **Secrets**: no committed API keys, service-role tokens, private keys, or credentials anywhere in
  the tree; `.env.example` contains only empty placeholders; `src/lib/supabase/browser.ts` never
  references a service-role key.
- **Actor attribution**: every `reviewed_by`/`actor_profile_id`/`assigned_by`/`created_by`-shaped
  column checked is either set inside a `SECURITY DEFINER` RPC using `auth.uid()` directly, or
  locked by a `before insert/update` trigger — no remaining client-suppliable actor field found in
  any of the tables spot-checked (`audit_logs`, `notifications`, `quotations.created_by`,
  `legal_requirements.created_by`, `transport_documents.reviewed_by`,
  `user_verifications.reviewed_by`, `moderation_appeals.reviewed_by`,
  `fundraising_campaigns.reviewed_by`, `risk_signals.reviewed_by`).
- **Suspended-driver access**: `is_my_driver_id()`, `is_assigned_driver_for_request()`, and both
  driver-facing `transport_documents`/storage-object policies all require
  `has_role(auth.uid(), 'driver')` (which itself requires `user_roles.status = 'active'`) in
  addition to the `profile_id` match — confirmed no remaining unprotected `d.profile_id = auth.uid()`
  instance exists anywhere in the current migration set (5 historical occurrences found by grep, all
  either superseded-and-fixed or already-correct in their final form).
- **`driver_transport_job_view`**: explicitly declared `with (security_invoker = true)`, with a
  comment correctly explaining why (row-level RLS from the base table must still apply, unlike the
  blanket-public `public_transport_requests`/`public_routes` views) — the one place in this schema
  where getting invoker/definer semantics wrong would have been a severe exact-address leak, and it
  is correct.
- **Storage tenant binding**: `kennel-media` (public bucket) and `transport-documents` (private
  bucket) policies correctly bind the first path segment to `owns_org()`/`requester_profile_id`
  ownership checks; no path-traversal concern (object storage keys are opaque strings, not
  filesystem paths — a `../` segment has no special meaning to Supabase Storage).
- **Concurrency**: `approve_user_verification()`, `claim_moderation_case()`, `claim_support_case()`
  all use `select ... for update` row locks with an explicit post-lock status check before any
  side-effecting write — correct, standard-pattern protection against double-processing races.
  `reservations` has a partial unique index preventing double-reservation of the same animal;
  `start_transport_conversation()`/`start_application_conversation()` are protected by a unique
  index and an advisory lock respectively (verified present in
  `20260101009400_concurrency_hardening.sql`).
- **Driver status state machine**: `prevent_non_staff_operational_field_changes()`
  (`20260101011100_driver_status_state_machine.sql`) enforces an explicit, real transition graph
  matching the UI's own linear step sequence and the full-journey test scenario — a driver cannot
  skip or reverse a status.
- **Migration hygiene**: zero duplicate timestamp prefixes across all 118 files; no
  `add column ... not null` without a paired `default`; every `SELECT *` found is an internal
  `SELECT * INTO <record variable>` inside `plpgsql` function bodies (never returned wide to a
  client) — the standard, safe idiom, not the client-facing anti-pattern.

## 9. RLS and grant inventory

- 70/70 tables have RLS enabled (exhaustive check, see §8).
- Table-level grants are centralized in `20260101002900_table_grants.sql` (public-read-eligible
  tables get `anon` + `authenticated`; everything else gets `authenticated`-only; nothing is
  ungranted-but-RLS-protected in a way that would make an admin policy unreachable — spot-checked
  `rate_limit_events`, whose own comment documents exactly this "RLS correct but grant missing"
  failure mode having been hit and fixed once already for that table).
- One confirmed real gap: blanket `update, delete` grants on append-only-shaped tables (§6.3).
- `FOR ALL` policies found: 9 in `20260101001900_community.sql` (all on genuinely user-mutable
  content — comments/posts/reactions/follows/saved items — correct), plus the two append-only-table
  instances covered in §6.2 and the already-fixed `transport_status_history` instance (§8).

## 10. `SECURITY DEFINER` inventory

95 `CREATE [OR REPLACE] FUNCTION` statements found across all migrations; 90 are `SECURITY DEFINER`
(the rest are plain `SECURITY INVOKER`-default helper/trigger functions with no elevated need). All
90 `SECURITY DEFINER` functions pin `set search_path = public` in the same statement — zero
exceptions. Full extraction script and output were written to `.audit-temp/` during this audit and
removed before the final commit per instructions; the finding (0 missing pins out of 90) is recorded
here as the durable evidence.

## 11. Storage inventory

Two buckets: `kennel-media` (public=true, 20MB limit) and `transport-documents` (public=false, 20MB
limit) — confirmed via `supabase/migrations/20260101002200_storage.sql`. A third,
`message-attachments`, was added later (`20260101008700_message_attachments_storage.sql`, private,
scoped via `is_conversation_participant()`) — not independently re-verified in depth this pass
(time-boxed; flagged for a deeper look by a future audit or Bot 2). `kennel-media` correctly allows
public `SELECT` (intentional — logos/covers/animal photos are already public marketing content) and
scopes write access to the owning org's own path segment. `transport-documents` correctly restricts
all access to requester + assigned-driver (read-only, active-role-checked) + ops staff — no broader
exposure found.

## 12. State-machine findings

- **Fundraising campaigns**: real status-skip, §5.1.
- **Quotations**: real terminal-state/expiry-bypass gap, §6.1.
- **Driver transport status**: correctly enforced transition graph, §8 (verified adequate).
- **Transport document review**: correctly locked — a requester cannot self-set
  `status='accepted'` or forge `reviewed_by`/`reviewed_at`, and an accepted document is fully locked
  from requester-side mutation (`20260101009600_transport_document_review_lock.sql`, independently
  re-read and confirmed matching its own changelog description).
- **User/organisation verification approval**: idempotent, race-safe (§8).
- **Buyer applications / reservations**: org-side status transitions are intentionally unrestricted
  (the org is the trusted decision-maker for its own applications), but reservation creation
  correctly requires `buyer_applications.status = 'approved'` first — independently re-read and
  confirmed the gate is real (not just claimed).

## 13. Concurrency/idempotency findings

No new races found beyond what the backend session's own Stage J hardening
(`20260101009400_concurrency_hardening.sql`) already closed and this audit independently
re-verified (reservations unique index, conversation-start unique index/advisory lock).
Claim-pattern RPCs (`claim_moderation_case`, `claim_support_case`, `approve_user_verification`) all
correctly use `for update` locking. No double-completion path found for any of these. The one
related integrity gap found (quotation terminal-state, §6.1) is a missing state guard, not a
concurrency race per se — two concurrent flip-attempts would both still succeed sequentially, not
because of a race, but because nothing ever forbids the flip regardless of timing.

## 14. Privacy findings

No exact-address, phone/email, reporter-identity, internal-note, application-answer, or
document-path leak found in any public- or broad-authenticated-reachable policy or view.
`private_addresses` is correctly scoped to owner/org/admin only. `driver_transport_job_view`
correctly uses `security_invoker` so exact addresses stay row-scoped to the assigned driver only.
`audit_logs`/internal-note-shaped columns are correctly excluded from non-staff-reachable selects
(confirmed by the RLS policies read; application-layer column selection was not independently
re-verified for every query file — see Limitations). No new privacy gap found this pass.

## 15. Frontend integration conflicts

This is where this audit's independent git-history cross-referencing produced findings the
frontend's own `FRONTEND_MERGE_CONFLICT_PLAN.md` could not have had visibility into (it could only
read backend file paths, not backend commit history against the actual shared ancestor).

**Method**: for every file the frozen frontend branch (`origin/ux-marketplace-frontend-pass`)
touched relative to its own base (`02e6416`), checked whether the *current backend snapshot*
(`e6270a0`) contains any commit touching the same file that is **not** an ancestor of that same base
— i.e., a real, independent, post-divergence edit on the backend side, not just pre-existing shared
history both branches inherited.

| File | Post-divergence backend commit | Real conflict risk |
|---|---|---|
| `src/routes/dashboard.buyer.transport.tsx` | `fd33235` "Stage C / Phase 11: real transport timeline..." — adds a `TransportTimeline` component, `getCustomerTimeline()` import, a "Timeline" toggle, touching the same import block and page body the frontend session also restructured (EmptyState/ErrorState/AnimalImage/locale-date rollout) | **High.** The frontend's own merge plan lists `dashboard.buyer.*` as "frontend should win on any textual conflict" — applying that rule verbatim to this specific file would silently delete the backend's entire Timeline feature. Needs manual combined resolution, not the default rule. |
| `src/lib/queries/marketplace.ts` | `38cc74f` "Stage N: fix marketplace listing N+1 queries..." — batches `mapLitterRow`/`mapOrgToBreeder` into `mapLitterRows`/`mapOrgsToBreeders`, the **same function names and same N+1 fix category** the frontend session's own commit `2d011c7` independently applied | **High.** Both sides rewrote the same functions for the same reason; a git cherry-pick will very likely produce a real textual conflict here, not a clean apply. Needs a side-by-side read of both versions to reconcile (likely keep whichever is more complete, or manually merge if they diverge in scope) rather than blindly taking either side. |
| `src/lib/queries/buyer-activity.ts` | same `38cc74f` commit (touches both files together) | Same as above — High. |
| `src/lib/queries/profile.ts` | `8743f91` "Stage CE: data-access consolidation" — appends `getMyProfile()`/`updateMyPhone()` at the end of the file | **Low-moderate.** The frontend's edits (renaming `getPublicKennelSlugForOwner`→`getPublicOrgLinkForOwner`, adding `listPublicPostsByOrg`) are in a different region of the file than the backend's pure end-of-file appends — a cherry-pick will likely apply cleanly, but this is a real co-modification the frontend's plan didn't know about; verify with `tsc --noEmit` immediately after, not just a clean exit code. |
| `src/routeTree.gen.ts` | 3 independent backend commits adding new routes (moderation appeals, org team/invitation management, welfare/rescue transport workflow) | **None, if handled correctly** — both sides' own docs already correctly say never hand-resolve this file, always regenerate. This confirms *why*: it has drifted substantially and a stale merge would be actively wrong, not just cosmetically different. |
| `package.json` | `c3321f1` "Stage CA: migration preflight command" — adds one `"scripts"` entry | **Low**, as the frontend's own plan already anticipated (different script keys, standard auto-mergeable shape). |

Files the frontend touched with **no** post-divergence backend history (confirmed genuinely
low-conflict, matching the frontend's own assessment): every other `src/routes/_public.*` file,
`src/components/cards.tsx`, `src/components/site-chrome.tsx`, `src/lib/queries/community.ts`,
`src/lib/i18n/*`, all new frontend-only files (`src/lib/presentation/*`, `src/lib/org-routing.ts`,
`src/components/public/*`, `src/components/marketplace/animal-image.tsx`, `tests/unit/*`) — these
files' apparent backend-side "history" is entirely pre-existing commits both branches share from
before the frontend branch was cut, not independent later edits.

**Schema-compatibility spot check** (not just textual-conflict risk): manually cross-referenced
`marketplace.ts`'s `animalSelect`/`orgSelect`/`litterSelect`/`adoptionSelect` column lists against
the current `animals`/`organisations`/`posts` table definitions at the audited snapshot — every
column referenced exists; `organisations.owner_user_id` (which a schema evolution toward
`organisation_members`-based team ownership could plausibly have deprecated) is still present and
unchanged. No schema-drift breakage found for the query files checked.

## 16. Test-quality findings

- 47 `tests/db/*.test.ts` files, ~9,745 lines total.
- Zero weak-assertion patterns found (`toBeTruthy()`/`toBeDefined()`-only checks) — every assertion
  checked compares real expected values.
- `Date.now()`-based test-data uniqueness in 17 files — see §7.3 (Low).
- `tests/db/helpers.ts` (181 lines) provides a shared, deterministic
  `createTestTransportRequest()` factory, per the backend's own changelog — confirmed present and
  used by the two most-recently-added test files; three older files were deliberately left on their
  own pre-existing (already-correct) fixture code rather than churned for a stylistic-only change —
  a reasonable, explicitly-documented tradeoff, not an oversight.
- Not independently re-run this pass (no local Supabase instance available — see Limitations); test
  *quality* (structure, assertion strength, fixture isolation) was reviewed by reading, not by
  executing.

## 17. Recommended Bot 2 fix order

1. **§5.1 fundraising `active` self-set** — highest severity, smallest fix, already has a proven
   template (the sibling `target_reached`/`partially_funded` fix in the same file).
2. **§15 frontend integration conflicts** — must be resolved *during* the actual cherry-pick/merge
   step, not as a standalone migration; flag to whoever performs the integration before they start,
   not after a conflict is already half-resolved incorrectly.
3. **§6.1 quotation terminal-state guard** — second-highest real severity, independent of #1 and #2.
4. **§6.2 `animal_ownership_history` immutability** — mirrors an existing, proven pattern in the same
   codebase; low implementation risk.
5. **§6.3 blanket grants on append-only tables** — bundle with #4 (same migration file makes sense).
6. **§7.1–7.3** — low priority, no urgency; pick up opportunistically.

## 18. Exact reproduction commands

All commands assume a `supabase-js` client authenticated as the actor named in each finding (or the
equivalent raw PostgREST `curl` call with the actor's JWT in the `Authorization` header).

```js
// §5.1 — fundraising self-publish (as the eligible org's owner)
await supabase.from('fundraising_campaigns')
  .update({ status: 'active' })
  .eq('id', myDraftCampaignId); // succeeds today; should be rejected

// §6.1 — quotation terminal-state reopening (as the transport request's requester)
await supabase.from('quotations').update({ status: 'accepted' }).eq('id', quotationId);
await supabase.from('quotations').update({ status: 'rejected' }).eq('id', quotationId); // succeeds; should be rejected once already decided

// §6.2 — animal_ownership_history admin mutation (as an admin-role user)
await supabase.from('animal_ownership_history').delete().eq('id', someHistoryRowId); // succeeds; should be rejected
```

```bash
# Read-only git evidence used for §15 (safe to re-run against the real repos)
git log --oneline -- src/routes/dashboard.buyer.transport.tsx
git show fd33235 --stat -- src/routes/dashboard.buyer.transport.tsx
git diff 02e6416 origin/ux-marketplace-frontend-pass -- src/lib/queries/marketplace.ts | head -50
```

## 19. Limitations

- **Static audit only** — no `supabase db reset` or `test:db` run (no local Supabase/Docker instance
  reachable in this environment). All findings are confirmed by reading SQL/policy text directly,
  not by executing against a live database. The three exploit repros in §18 are logically derived
  from the policy text (confirmed correct by manual trace of the `USING`/`WITH CHECK` clauses
  against the schema), not empirically fired against a running instance.
- **Time-boxed, not exhaustive** — 118 migrations, 95 functions, 70 tables, and 47 test files are a
  large surface; this pass prioritized the categories most likely to hide real, exploitable bugs
  (RLS transition gaps, actor forgery, append-only-table mutability) over an exhaustive line-by-line
  read of every file. `message-attachments` storage (added later in the session) and the full
  `welfare_cases`/`support_cases`/`risk_signals` feature areas were read for actor-attribution and
  `SECURITY DEFINER` purposes but not independently re-derived from first principles the way
  fundraising/quotations/ownership-history were.
- **Frontend inspection was read-only and file-targeted**, not a full re-read of every frontend
  query file against the current schema — `marketplace.ts`, `buyer-activity.ts`, `profile.ts`,
  `community.ts` were checked; `messaging`/`notifications` query modules were not independently
  cross-checked against current schema this pass (flagged as a gap for a future pass, not asserted
  clean).
- **No performance/EXPLAIN analysis** — the backend's own documented position (real usage data
  needed before indexing further) was read and accepted as reasonable, not independently
  re-litigated against seed-data volume.
- **Backend's own docs were used as a map, never as evidence** — every claim from
  `docs/AUTONOMOUS_BACKEND_PROGRESS.md`/`docs/TECH_DEBT_REGISTER.md` that fed into a finding or a
  "verified adequate" conclusion was independently re-checked against the actual current SQL; several
  claims held up exactly as stated (driver suspension, audit-log actor lock), and the fundraising gap
  is a genuine case where the pattern the backend session itself established elsewhere was not
  applied consistently.

## 20. Final snapshot hash

Source repo snapshot audited: `e6270a04e5b1598c48bdeb37ac371afafea1fbff`.
Frontend reference audited: `727d551b8306cf6bd5ce8a2b542ac118b1c4f417` (`origin/ux-marketplace-frontend-pass`).
