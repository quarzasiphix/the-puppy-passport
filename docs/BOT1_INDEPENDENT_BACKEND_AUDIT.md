# Bot 1 — Independent Adversarial Backend Audit (Six-Hour Pass)

Read-only, evidence-based audit of the Havenpaw backend (`supabase/migrations/*.sql`, `src/lib/**`,
`tests/db/*`, and the frozen frontend integration contract), performed in an isolated clone. No
application code, migration, test file, or either real worktree (`/p/the-puppy-passport`,
`/p/the-puppy-passport-ux`) was modified, entered, or checked out. This is a broader, independent
re-run of an earlier ("four-hour") pass committed at
`/p/the-puppy-passport-bot1-audit-20260725-080809` (branch `audit/bot1-backend-20260725-080815`,
commit `e3214b4`) — that report was read for pattern-matching context only; every claim reused here
was independently re-verified against the current SQL, never cited as evidence on its own.

## 1. Snapshot and environment

- **Source repo**: `/p/the-puppy-passport` (main worktree, never entered or modified).
- **Phase 1 source snapshot** (`main` HEAD at clone time): `9b16b98ef25343ea31ace7f39b24d72ed61492a1`
  ("Record Stage IR-9 in the autonomous backend progress log").
- **Phase 2 (delta) source snapshot**: `359e0f3bba34ddb1d886f3e62bffb57cbad6f463` ("Fill in Stage
  IR-10's own commit hash") — captured via `git fetch origin` into this clone
  (`audit/latest-source` local branch), never by touching the real worktree.
- **Audit clone**: `/p/the-puppy-passport-bot1-audit-20260725-175844` (`--no-hardlinks`, fully
  independent working tree and object store).
- **Audit branch**: `audit/bot1-backend-20260725-175844`, branched from a detached checkout of the
  Phase 1 snapshot.
- **Frontend reference**: `ux-marketplace-frontend-pass` (fetched remote-tracking ref), inspected
  read-only via `git show <ref>:<path>` / `git diff <snapshot>...<ref> -- <path>`, never checked
  out.
- **Local Supabase/Docker**: a local Supabase Postgres stack (`supabase_db_the-puppy-passport`,
  Postgres 17.6) was reachable on this host during the audit. It is a **shared instance tied to the
  real source repo's `project_id`**, not exclusive to this audit clone, and was confirmed (via
  `supabase_migrations.schema_migrations`) to already be at the Phase 1 snapshot's final migration.
  Given the hard constraint "do not modify the real backend," and that this instance may be
  concurrently used by other agents/processes, this audit used it **strictly read-only**
  (`docker exec supabase_db_the-puppy-passport psql -U postgres -d postgres -c "<SELECT ...>"` for
  live RLS/grant/`SECURITY DEFINER`/storage inventory) and deliberately did **not** run
  `supabase db reset`, `test:db`, or any migration against it. See §24/§26 for what this means for
  "Phase 1 Verification."
- **Method**: static SQL/TypeScript review (126 migrations, `src/lib/queries/*.ts`, `tests/db/*`)
  cross-checked against live, read-only Postgres introspection (`pg_policies`, `pg_proc`,
  `information_schema`, `storage.buckets`) on the shared local instance described above, plus a
  focused delegated-agent pass (four parallel research agents, each covering a cluster of the 16
  audit areas) whose raw findings were independently spot-verified before inclusion here, never
  taken at face value. One mid-audit interruption occurred (a session/budget reset); all four
  research agents were successfully resumed from their transcripts afterward with no loss of prior
  progress, and the primary investigator's own findings (this document's highest-severity items)
  were already persisted in conversation state and re-confirmed against the live filesystem/DB
  after resuming, not reconstructed from memory.

## 2. Executive summary

This backend has been through an unusually long, unusually rigorous self-hardening session (~50+
documented real fixes, 790+ passing `test:db` tests claimed at the last checkpoint before this
audit, systematic sweeps for forgeable-actor-id bugs, self-approval bugs, and concurrency races).
Baseline hygiene is genuinely clean: **70/70 public tables have RLS enabled**, **all 76 currently
live `SECURITY DEFINER` functions pin `search_path`** (both confirmed by live introspection, not
just grep), no duplicate migration prefixes, no committed secrets, no service-role key in browser
code, and `profiles.email`/`phone` are provably excluded from every broad `SELECT` grant (verified
via `information_schema.column_privileges`, not just by reading migration comments).

Despite that, this independent pass confirms **three carried-forward gaps are still live** (one
High, re-verified byte-for-byte against the *current*, most-recent migration; two Medium) and finds
**two new High-severity issues** this pass discovered independently, both exploiting the same root
architectural tension the codebase has only partially closed: RPCs correctly embed business rules,
actor-stamping, and (for a few flows) a reauthentication step-up gate — but several of the
underlying tables still carry a blanket `FOR ALL … using (is_admin())` (or similar) RLS policy with
no matching restriction, so a raw Data API call can bypass the RPC and its guarantees entirely.

- **Fundraising campaigns can still be self-published to `active` by the owning org**, bypassing
  admin review — confirmed unfixed against the newest migration set, and made more notable by the
  fact that this exact self-approval *pattern* was independently found and fixed for
  `organisations.verification_status` in a *later*-numbered migration in the same session
  (`20260101011700`), meaning the team re-discovered and re-fixed this bug class after it was
  already live here and still didn't close this instance.
- **`legal_holds` and `account_deletion_requests` can be raw-written by any admin session,
  bypassing `require_recent_auth()`'s step-up gate and the RPC's actor-stamping/business-safety
  checks** — a newly-discovered, confirmed, reachable gap that defeats the specific security control
  the codebase built for exactly this threat model (a stale/hijacked admin session performing a
  rare, destructive, legal-sensitive action).
- **`create_notification_if_enabled()` lets any authenticated user send an arbitrary-content,
  platform-styled notification (attacker-controlled title/body/link) to any other user**, with no
  relationship check and no rate limit — a newly-discovered notification-spoofing/phishing vector,
  in direct contrast to the same table's other, carefully relationship-scoped RLS insert policy.
- **Quotations' terminal-state gap is only partially fixed**: the newest migration
  (`20260101012400`, the single most recent commit in the Phase 1 snapshot) closes the
  accept-after-expiry bypass but leaves the underlying "no `OLD.status` check at all" gap open — a
  requester can still flip `accepted`⇄`rejected` indefinitely and un-terminal-ize a `replaced` quote.
- **`animal_ownership_history` is still `FOR ALL` admin-mutable**, unlike its structurally identical
  sibling `transport_status_history`, which was explicitly locked to append-only in the same
  session.

No Critical-severity finding: every issue above requires either an already-privileged actor (an
org owner acting only on their own campaign; an admin session) or, for the notification-spoofing
issue, does not directly compromise data confidentiality/integrity (it is an abuse/trust-and-safety
vector). See §5 for why each is High rather than Critical.

## 3. Integration blockers

| # | Finding | Why it blocks |
|---|---|---|
| 1 | Fundraising campaign self-publish (§5.1) | Must be fixed before `FUNDRAISING_ENABLED` is ever turned on anywhere real users can reach it — the RLS gap exists regardless of the frontend flag, which is UI-only, not RLS-enforced (independently confirmed: `src/lib/fundraising-flag.ts` is a pure client constant with no server-side mirror). |
| 2 | `legal_holds`/`account_deletion_requests` raw-write bypass (§5.2) | A real admin workflow (account deletion) has a documented, deliberately-built safety control (`require_recent_auth`, legal-hold blocking) that is silently bypassable today; should be closed before this becomes the actual path any tooling/support runbook relies on. |
| 3 | `create_notification_if_enabled()` unrestricted recipient/content (§5.3) | Any new caller of this primitive (and a 4th one was added in the Phase 2 delta, §25) inherits the gap; should be closed at the primitive, not per-caller, before more producers are added. |

Findings in §6 (Medium) and §7 (Low) are real but do not block integration in the strict sense —
they are pre-existing backend gaps independent of any frontend integration step.

## 4. Critical findings

None found at Critical severity. §5.1/§5.2/§5.3 are High rather than Critical because each requires
an actor who is already privileged in some way (the campaign's own owning org; an existing admin
session) or does not itself compromise confidentiality/integrity of protected data (notification
spoofing is an abuse vector, not a data breach) — none of the three lets an unprivileged actor read
or write another tenant's protected data directly.

## 5. High findings

### 5.1 — Fundraising campaigns can still be self-published to `active`, bypassing admin approval

- **Severity**: High.
- **Exact location**: `supabase/migrations/20260101005600_fundraising.sql`, policy `"eligible org
  owners update their own non-terminal campaigns"` on `public.fundraising_campaigns`, as last
  redefined by `supabase/migrations/20260101009100_fundraising_outcome_status_lock.sql` (confirmed:
  no migration after `20260101009100` touches this policy — `grep -n '"eligible org owners update
  their own non-terminal campaigns"' supabase/migrations/*.sql` returns only these two files).
- **Reachable actor**: any authenticated user who owns an organisation eligible for fundraising
  (`is_eligible_fundraising_org()`) with a `fundraising_campaigns` row in `draft` or
  `organisation_review`.
- **Reproduction path**:
  ```js
  await supabase.from('fundraising_campaigns')
    .update({ status: 'active' })
    .eq('id', myDraftCampaignId); // succeeds today; should require an admin
  ```
  The current policy text (`20260101009100`, lines 18–32): `using (public.owns_org(organisation_id)
  and status not in ('completed', 'refund_review'))`, `with check (public.owns_org(organisation_id)
  and public.is_eligible_fundraising_org(organisation_id) and
  public.fundraising_campaign_links_are_valid(...) and status in ('draft', 'organisation_review',
  'active', 'expired', 'transport_cancelled'))`. `'active'` sits on the org-settable side with no
  `OLD.status = 'approved'` requirement — nothing in the `USING`/`WITH CHECK` pair, and no trigger,
  inspects the row's prior status before allowing the jump straight from `draft`/
  `organisation_review` to `active`.
- **Expected invariant**: `docs/FUNDRAISING_POLICY.md` §"Campaign states" (line 82): `` `draft` →
  `organisation_review` → `approved` → `active` → … `` — `approved` (admin-only) must precede
  `active`. The team's own `docs/DATABASE_INVARIANTS.md` (line 51) states "an org can never
  self-declare `target_reached`/`partially_funded`" — deliberately *not* claiming the same for
  `active`, which matches what the code actually does (the doc does not overclaim).
- **Observed behavior**: the campaign becomes publicly visible immediately (`"public reads active
  fundraising campaigns"` includes `status = 'active'`, `supabase/migrations/20260101005600`, line
  129) with its title/description/target amount shown to anonymous visitors, never reviewed by an
  admin. Independently confirmed this is not merely a display bug: once `active`, the same org's own
  campaign can also start legitimately accepting (simulated) contributions
  (`"buyers create contributions"` on `fundraising_contributions` only requires `status in ('active',
  'target_reached', 'partially_funded')`, `20260101005600` line 207) — i.e. the self-publish also
  unlocks a second, contribution-facing surface, not just visibility.
- **Compounding evidence this is a real miss, not accepted risk**: `supabase/migrations/
  20260101011700_organisation_verification_lock_and_admin_audit.sql` (Stage CJM, a *later*-numbered
  migration in the same session, dated after `20260101009100`) independently rediscovers and fixes
  the **exact same bug class** for `organisations.verification_status` — its own comment says
  verbatim: "the same self-approval bug class this session has closed repeatedly elsewhere
  (rehoming_reviews, buyer_applications), just never checked for this specific column until now."
  `fundraising_campaigns.status='active'` fits that description precisely and was not checked.
- **Smallest fix**: move `'active'` to the admin-only side, matching the exact template already used
  for `target_reached`/`partially_funded` in the same file:
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
- **Regression test**: extend `tests/db/fundraising.test.ts`: an org owner attempts `update ...
  set status = 'active'` on their own `draft`/`organisation_review` campaign and is rejected; an
  admin performing the same update succeeds.
- **Integration-blocker status**: yes — see §3.
- **Overlap risk with Bot 2**: moderate-high — this is exactly the self-approval pattern the
  session's own later stage (CJM) re-derived from first principles; a second adversarial pass
  auditing status-transition policies would plausibly find it the same way.

### 5.2 — `legal_holds` / `account_deletion_requests` can be raw-written, bypassing the reauthentication step-up gate, actor stamping, and (for deletion) every business-safety check

- **Severity**: High (matches the rubric's explicit "legal-hold bypass" and "actor spoofing"
  categories).
- **Exact location**:
  - `supabase/migrations/20260101011500_legal_holds.sql` line 34: `create policy "admins manage
    legal holds" on public.legal_holds for all to authenticated using (public.is_admin()) with
    check (public.is_admin());` plus line 40: `grant select, insert, update on public.legal_holds
    to authenticated;`.
  - `supabase/migrations/20260101004800_account_deletion_requests.sql` lines 24–30: `"admins manage
    all deletion requests" for all using (is_admin()) with check (is_admin())`, plus `grant select,
    insert, update, delete on public.account_deletion_requests to authenticated`.
  - Confirmed **live** against the running instance (not just the migration text): `select
    policyname, cmd, qual, with_check from pg_policies where tablename='legal_holds'` returns
    exactly one row (`admins manage legal holds | ALL | is_admin() | is_admin()`), and `select
    tgname from pg_trigger where tgrelid='public.legal_holds'::regclass and not tgisinternal`
    returns **zero rows** — no trigger exists to lock `placed_by`/`released_by` or to require recent
    auth at the table layer.
  - Compare with `place_legal_hold()`/`release_legal_hold()`/`execute_account_deletion()`
    (`supabase/migrations/20260101011800_recent_auth_step_up.sql`), which correctly call `perform
    public.require_recent_auth(...)` and stamp `placed_by`/`released_by`/`processed_by` from
    `auth.uid()` — but only when called *as an RPC*.
- **Reachable actor**: any user holding the `admin` platform role, regardless of how long ago they
  last authenticated (exactly the threat model `require_recent_auth()` was built to mitigate — a
  stale-but-still-valid admin session/token).
- **Reproduction path**:
  ```js
  // Bypasses require_recent_auth('legal_hold.place') entirely, and forges placed_by:
  await supabase.from('legal_holds').insert({
    subject_profile_id: targetUserId,
    reason: 'pretext',
    placed_by: someOtherAdminUuid, // no trigger stops this
  });

  // Bypasses require_recent_auth('legal_hold.release') and forges released_by, silently
  // unblocking a deletion that execute_account_deletion() would otherwise refuse:
  await supabase.from('legal_holds').update({
    released_at: new Date().toISOString(), released_by: someOtherAdminUuid,
  }).eq('id', holdId);

  // Bypasses execute_account_deletion() ENTIRELY -- no require_recent_auth, no transport/
  // reservation/application/org-ownership/legal-hold blocker check, and the profile is never
  // actually anonymised (the RPC's own UPDATE on `profiles` never runs) -- yet the request row
  // now reads "processed", a false audit record:
  await supabase.from('account_deletion_requests').update({
    status: 'processed', processed_at: new Date().toISOString(), processed_by: someOtherAdminUuid,
  }).eq('id', requestId);
  ```
- **Expected invariant**: `docs/DATABASE_INVARIANTS.md`'s own "Server-stamped actors (never
  client-forgeable)" section lists 11 specific columns it guarantees are never client-forgeable —
  `legal_holds.placed_by`/`released_by` and `account_deletion_requests.processed_by` are *not* on
  that list, and this audit confirms they are, in fact, forgeable via the raw table. The
  `20260101011800` migration's own stated purpose ("fail-closed step-up check … no client-supplied
  bypass") is defeated for exactly the two operations it names as most important to gate.
- **Observed behavior**: as above — full bypass of reauth, actor stamping, and (for deletion) every
  safety check, all via a plain Data API insert/update. **Not reachable through the real app UI**
  (`src/lib/queries/privacy.ts`'s `markDeletionRequestProcessed()` correctly calls the
  `execute_account_deletion` RPC for the `processed` transition, never a raw update — confirmed by
  reading the function), and **not covered by any existing test**: `tests/db/legal-holds.test.ts`
  only exercises the RPC path in both directions, never attempts a raw insert/update, so this gap
  would not be caught by the existing suite either.
- **Smallest fix**: two options, matching existing patterns in this same codebase — (a) lock the
  actor columns with a `before insert or update` trigger (the `stamp_notification_actor()`/
  `prevent_org_owner_transfer_by_non_admin()` pattern) that also calls `require_recent_auth()` for
  the specific transitions that matter, so the RLS layer enforces the same guarantee the RPC does;
  or (b), the narrower fix already used elsewhere in this codebase for RPC-fronted tables, revoke
  `insert`/`update` from `authenticated` on both tables entirely (the RPCs are `SECURITY DEFINER`
  and don't need the grant) and let only `service_role`/the RPC's elevated context write — this is
  the smaller, single-migration fix.
- **Regression test**: a non-RPC raw insert into `legal_holds`/update to `account_deletion_requests`
  by an admin who has not recently authenticated should be rejected (or, under fix (b), rejected for
  everyone including a recently-authenticated admin, since only the RPC path would remain).
- **Integration-blocker status**: yes — see §3.
- **Overlap risk with Bot 2**: low-moderate. This requires specifically checking whether an
  RPC-embedded security control (reauth, actor-stamp) has an equivalent RLS-layer guarantee, not
  just reading the RPC itself — the RPC in isolation looks completely correct.
- **Systemic pattern, not isolated**: the same root cause (a business-rule/idempotency-bearing RPC
  fronting a table whose own RLS is a blanket `FOR ALL using (is_admin())`) also affects
  `approve_user_verification()` vs. `user_verifications` (a raw admin update of `status='approved'`
  would skip organisation creation and role-granting, leaving a visibly-approved-but-functionally-
  broken verification — a data-integrity bug, Medium, not a security escalation since it grants
  nothing extra). A third instance, lower-severity but worth noting: `user_consents`
  (`supabase/migrations/20260101010200_legal_consent_versioning.sql`, lines 84–87) is explicitly
  documented in its own migration comment as append-only, immutable "evidence of what they actually
  agreed to and when" — yet carries `"admins manage all consent records" for all using (is_admin())
  with check (is_admin())`, the same unrestricted admin mutability gap as §6.2's
  `animal_ownership_history`, on a table whose own stated purpose is legal evidentiary integrity.
  Given 83 `FOR ALL` policies exist across the public schema (live count), Bot 2 should treat this as
  a pattern to sweep for broadly (every `SECURITY DEFINER` RPC with real business logic or every
  table whose own comments claim immutability, cross-referenced against its table's RLS), not just
  fix the specific instances named in this report.

### 5.3 — `create_notification_if_enabled()` lets any authenticated user send arbitrary-content, platform-styled notifications to any other user

- **Severity**: High.
- **Exact location**: `supabase/migrations/20260101012200_notification_template_versioning.sql`
  lines 18–58 (current, final definition — confirmed no later migration in either the Phase 1 or
  Phase 2 snapshot redefines it), `grant execute on function
  public.create_notification_if_enabled(uuid, text, text, text, text, text, text, integer) to
  authenticated;` (line 58).
- **Reachable actor**: any authenticated user, of any role, with zero relationship to the target.
- **Reproduction path**:
  ```js
  await supabase.rpc('create_notification_if_enabled', {
    p_profile_id: victimProfileId,        // any other user's id -- not validated at all
    p_category: 'moderation',              // or any string; 'security' is always force-enabled
    p_notification_type: 'account_alert',
    p_title: 'URGENT: verify your account',
    p_body: 'Click the link below or your account will be suspended.',
    p_link_url: 'https://attacker.example/phish',
  });
  // Succeeds -- a real row appears in the victim's in-app notification feed, styled identically
  // to a genuine system notification, with a fully attacker-controlled link.
  ```
- **Expected invariant**: the codebase clearly understands the correct pattern — the *other* insert
  path into the same table, `"org owners notify applicants to their organisation"`
  (`supabase/migrations/20260101004900_notifications_org_owner_notify_applicants.sql`, lines 10–20),
  requires `exists (select 1 from buyer_applications ba where ba.buyer_id = profile_id and
  public.owns_org(ba.organization_id))` — a real relationship check. `create_notification_if_
  enabled()` has no equivalent check at all; its only gate (`get_notification_preference()`) checks
  whether the *recipient* has opted into that category, not whether the *caller* is allowed to send
  to that recipient.
- **Observed behavior**: as above. Also unrated-limited — none of the rate-limiting triggers wired
  elsewhere in this schema (`rate_limit_message_send`, `rate_limit_report_submission`, etc.) cover
  `notifications` inserts (confirmed: `grep -n "before insert on public.notifications"
  supabase/migrations/*.sql` returns only the actor-stamping trigger, not a rate limiter), so this
  is also an unbounded spam vector, not just a one-off forgery.
- **Smallest fix**: add a caller-authorization check inside the function itself (mirroring the
  org-owner policy's relationship check, or restricting the function to `is_ops_staff()`/system
  callers only and having genuine peer-to-peer notification flows go through their own
  relationship-scoped RPCs), or revoke `execute` from `authenticated` and grant it only to the
  specific narrower set of trusted server-side call paths. The 4 existing real producers
  (rehoming decision, application status change, moderation decision, and the newly-added moderation
  appeal decision, §25) are all triggered from contexts where the caller already holds the relevant
  relationship or role — none of them need blanket `authenticated` execute access.
- **Regression test**: a user with no relationship to another profile calls
  `create_notification_if_enabled` targeting that profile and is rejected; the 4 legitimate producer
  call sites still succeed.
- **Integration-blocker status**: yes — see §3.
- **Overlap risk with Bot 2**: moderate. Requires specifically comparing the RPC's authorization
  logic against the sibling direct-RLS-insert policy on the same table, which most single-table
  reviews would not think to do.

### 5.4 — `moderation_cases` resolution has no conflict-of-interest check, unlike its own appeal-review sibling

- **Severity**: High.
- **Exact location**: `supabase/migrations/20260101001800_moderation.sql` lines 57–61, `"moderators
  and admins manage all moderation cases" for all to authenticated using (is_moderator()) with check
  (is_moderator())`. Contrast `review_moderation_appeal()`
  (`supabase/migrations/20260101007900_moderation_appeals.sql` lines 213–217), which explicitly
  blocks `v_case.assigned_moderator_id = auth.uid()` — a conflict-of-interest check applied one layer
  up but never to the base case-resolution step it was modeled on.
- **Reachable actor**: any user holding the `moderator` role who is also the `affected_profile_id` on
  a case against them. Roles are additive (`public.user_roles`), so the same person can hold
  `moderator` and also be a breeder/org owner/regular user subject to a report.
- **Reproduction path**: `updateModerationCase()` (`src/lib/queries/moderation.ts` lines 135–153)
  does a raw `.from("moderation_cases").update(payload)`. As the reported moderator:
  `supabase.from('moderation_cases').update({ status: 'dismissed', decision_explanation: 'no issue
  found' }).eq('id', caseAgainstMe)` succeeds.
- **Expected invariant**: the same self-dealing guard `review_moderation_appeal()` already enforces
  one step later in the same workflow.
- **Observed behavior**: a moderator can resolve/dismiss a case naming themselves as the affected
  party, with no block, via the real UI.
- **Smallest fix**: add `and (affected_profile_id is distinct from auth.uid())` to the policy's
  `with check`, or route resolution through a `SECURITY DEFINER` RPC mirroring
  `review_moderation_appeal()`'s self-review guard.
- **Regression test**: as a user who is both moderator and the case's `affected_profile_id`, attempt
  to resolve/dismiss the case; assert rejection.
- **Integration-blocker status**: no — pre-existing backend gap, not tied to a frontend integration
  step.
- **Overlap risk with Bot 2**: moderate-high — this is the same conflict-of-interest pattern the
  session already fixed one level up (appeals); a pass specifically checking "does every
  decision-maker table guard against self-dealing" would likely find it too.

## 6. Medium findings

### 6.1 — Quotations' terminal-state gap is only partially fixed

- **Severity**: Medium (downgraded from the prior pass's Medium-High since the most damaging
  sub-case — accepting an already-expired quote — is now closed).
- **Exact location**: `supabase/migrations/20260101001500_quotations.sql` policy `"requesters
  accept or reject their own quotation"`, last redefined by
  `supabase/migrations/20260101012400_quotation_expiry_enforcement.sql` (the single most recent
  migration in the Phase 1 snapshot). Current, final text:
  ```sql
  create policy "requesters accept or reject their own quotation"
    on public.quotations for update to authenticated
    using (exists (select 1 from public.transport_requests tr where tr.id = transport_request_id
                   and tr.requester_profile_id = (select auth.uid())))
    with check (status in ('accepted', 'rejected')
                and (status <> 'accepted' or expiry_date is null or expiry_date >= current_date));
  ```
- **Reachable actor**: any authenticated requester on their own transport request's quotation, in
  any status.
- **Reproduction path**:
  ```js
  await supabase.from('quotations').update({ status: 'accepted' }).eq('id', quotationId);
  await supabase.from('quotations').update({ status: 'rejected' }).eq('id', quotationId); // still succeeds
  await supabase.from('quotations').update({ status: 'accepted' }).eq('id', quotationId); // flips back, still succeeds
  ```
  The `USING` clause checks row ownership only — it never inspects `OLD.status`. The column-lock
  trigger added earlier (`20260101008400_quotation_requester_field_lock.sql`) explicitly excludes
  `status` from its own before/after comparison (`v_old := to_jsonb(old) - 'status' - 'updated_at'`),
  so it does not narrow this gap either — confirmed by reading its current, unmodified body.
- **Expected invariant**: an accept/reject decision should be one-way and terminal, matching every
  other decision-state pattern in this schema (`buyer_applications`, `user_verifications`,
  `moderation_appeals` all guard against re-deciding an already-decided row); a `'replaced'`
  (superseded by a newer ops-issued quote) quotation should never become acceptable again.
- **Observed behavior**: `status` is freely toggleable between `accepted`/`rejected` regardless of
  the row's current status, and a `'replaced'` quotation with a null/future `expiry_date` can still
  be flipped back to `'accepted'` by the requester. No downstream trigger consumes `status='accepted'`
  to produce a side effect (grepped: zero triggers reference `quotations` for cascading writes), so
  the practical impact is state-integrity/business-logic, not a duplicate-financial-effect bug.
- **Smallest fix**: narrow `USING` to require a pre-decision status:
  ```sql
  using (
    status in ('sent', 'viewed')
    and exists (select 1 from public.transport_requests tr where tr.id = transport_request_id and tr.requester_profile_id = (select auth.uid()))
  )
  ```
- **Regression test**: extend `tests/db/quotation-expiry-enforcement.test.ts` or
  `tests/db/pricing-and-quotation-security.test.ts`: accept then attempt to reject (expect
  rejection); attempt to accept a `'replaced'` quotation (expect rejection).
- **Integration-blocker status**: no.
- **Overlap risk with Bot 2**: moderate — the newest migration's own commit message ("Prevent
  accepting an already-expired quotation") could easily read as "the quotation terminal-state issue
  is now fixed" to a reviewer who doesn't re-read the full `USING` clause.

### 6.2 — `animal_ownership_history` is still admin-mutable (`FOR ALL`), unlike its sibling audit-trail table

- **Severity**: Medium.
- **Exact location**: `supabase/migrations/20260101000900_animals.sql` lines 187–190, policy
  `"admins manage all ownership history"` on `public.animal_ownership_history`. Confirmed no later
  migration touches this table (`grep -rl "animal_ownership_history" supabase/migrations/*.sql`
  returns only this file and the blanket-grant migration `20260101002900_table_grants.sql`).
- **Reachable actor**: any admin.
- **Reproduction path**: `supabase.from('animal_ownership_history').delete().eq('id',
  someHistoryRowId)` succeeds (RLS `FOR ALL` + table grant both permit it).
- **Expected invariant**: the same session established an explicit precedent for exactly this shape
  in `supabase/migrations/20260101011300_immutable_status_history.sql`, which locked
  `transport_status_history` to `SELECT`+`INSERT`-only (including `revoke update, delete … from
  authenticated`) with the stated reasoning: "a genuine future correction need would go through
  direct database access (service role), never the app's normal RLS path." That treatment was never
  applied to `animal_ownership_history`.
- **Observed behavior**: an admin can rewrite or delete animal-provenance history rows with no
  separate audit requirement. `docs/TECH_DEBT_REGISTER.md` itself notes nothing in `src/` currently
  writes to this table at all, so real-world impact today is low, but the gap is real and reachable
  via the raw API.
- **Smallest fix**: mirror `20260101011300` exactly:
  ```sql
  drop policy "admins manage all ownership history" on public.animal_ownership_history;
  create policy "admins view all ownership history" on public.animal_ownership_history for select to authenticated using (public.is_admin());
  create policy "admins log ownership history" on public.animal_ownership_history for insert to authenticated with check (public.is_admin());
  revoke update, delete on public.animal_ownership_history from authenticated;
  ```
- **Regression test**: an admin attempts `update`/`delete` on a row and is rejected;
  `select`/`insert` still succeed.
- **Integration-blocker status**: no.
- **Overlap risk with Bot 2**: low-moderate — requires comparing two structurally identical tables'
  final states across all 126 migrations, not auditing each in isolation.

### 6.3 — `approve_user_verification()`'s business logic is bypassable via a raw `user_verifications` update (data-integrity, not privilege escalation)

- **Severity**: Medium.
- **Exact location**: `supabase/migrations/20260101000550_user_verifications.sql` lines 60–64,
  `"admins manage all verifications" for all using (is_admin()) with check (is_admin())`, vs.
  `approve_user_verification()` (`supabase/migrations/20260101009700_verification_approval_
  idempotency.sql`), which creates the `organisations` row, grants the platform role, and uses a
  `for update` lock — none of which happen on a raw update.
- **Reachable actor**: any admin (including via a scripting mistake, not just malice).
- **Reproduction path**: `supabase.from('user_verifications').update({ status: 'approved' }).eq(
  'id', verId)` succeeds and leaves the verification showing `approved` with **no organisation
  created and no role granted** — a broken, inconsistent state the UI would then present as
  successful.
- **Expected invariant**: state transitions with side effects should only be reachable through the
  RPC that performs them atomically (same principle as §5.2, lower severity here since no reauth
  gate or actor-forgery risk is defeated, only idempotency/atomicity).
- **Smallest fix**: revoke `update` on `user_verifications` from `authenticated` (the RPC is
  `SECURITY DEFINER` and doesn't need the grant), same pattern as the fix recommended in §5.2.
- **Regression test**: a raw update to `status='approved'` is rejected; the RPC path still works.
- **Integration-blocker status**: no.
- **Overlap risk with Bot 2**: low — easy to miss since the RPC itself is correct in isolation.

### 6.4 — `route_assignments.assigned_by` is forgeable via a raw update despite the RPC stamping it correctly (corrects §13)

- **Severity**: Medium. The actor is ops-staff, not anonymous/cross-tenant, but this directly
  contradicts §13's earlier "confirmed non-forgeable" claim for this exact column — corrected here.
- **Exact location**: `assign_request_to_route()`
  (`supabase/migrations/20260101009300_audit_logs_actor_lock_and_route_assignment_rpc.sql` lines
  23–61) correctly stamps `assigned_by = auth.uid()`. But the underlying `"ops staff manage route
  assignments" for all` policy on `public.route_assignments`
  (`supabase/migrations/20260101001700_routes_and_fleet.sql`) was never restricted to close off
  direct writes — confirmed live via `select policyname, cmd, qual, with_check from pg_policies
  where tablename='route_assignments'`, showing only `is_ops_staff()` on both sides, no column
  restriction.
- **Reachable actor**: any ops-staff account.
- **Reproduction path**: `supabase.from('route_assignments').insert({ route_id, request_id,
  assigned_by: someOtherStaffId })` — bypasses the RPC and its correct stamping entirely.
- **Expected invariant**: `docs/DATABASE_INVARIANTS.md`'s server-stamped-actor guarantee should hold
  for every column it implies is covered, not just non-forgeable-through-the-RPC-path.
- **Observed behavior**: attribution of who assigned a route can be forged by any ops-staff member
  via a raw insert/update.
- **Smallest fix**: revoke `insert`/`update` on `route_assignments` from `authenticated` (the RPC is
  `SECURITY DEFINER` and doesn't need the grant) — same pattern recommended for §5.2/§6.3.
- **Regression test**: a raw insert/update to `route_assignments` with `assigned_by` different from
  the caller's own id is rejected; the RPC path still succeeds.
- **Integration-blocker status**: no.
- **Overlap risk with Bot 2**: low — easy to miss since the RPC in isolation is correct, and §13's
  own summary line stated the opposite before this correction; re-verify before treating it as
  settled.

### 6.5 — `transport_status_history` INSERT allows forged `changed_by` and unconstrained `status`, poisoning the customer-facing timeline

- **Severity**: Medium.
- **Exact location**: `"requesters log status on their own request"` and `"assigned drivers log
  status on their own requests"` INSERT policies
  (`supabase/migrations/20260101001300_transport_requests.sql` lines 231–238, re-confirmed live
  after `20260101011300_immutable_status_history.sql`'s append-only lock, lines 34–37) — both `WITH
  CHECK` clauses verify only request ownership/assignment, never `changed_by = auth.uid()` nor that
  `status` matches a legal transition.
- **Reachable actor**: any requester (or assigned driver) on their own transport request.
- **Reproduction path**: `supabase.from('transport_status_history').insert({ transport_request_id: R,
  status: 'delivered', changed_by: anyUuid, customer_note: 'fake' })` for a request still in
  `'submitted'` — succeeds.
- **Expected invariant**: history rows rendered by `getCustomerTimeline()`
  (`src/lib/queries/transport.ts`) to every named party (requester/sender/recipient/current_owner)
  should reflect genuine system events only.
- **Observed behavior**: a forged row appears identically to a real one in the customer-facing
  timeline; `transport_requests.status` itself stays correctly protected, but the *displayed history*
  can lie.
- **Smallest fix**: add `changed_by = (select auth.uid())` and a legal-status check to both `WITH
  CHECK` clauses, or route all writes through a `SECURITY DEFINER` RPC and drop the direct insert
  grants (mirrors the pattern already used for `advance_transport_job_status`).
- **Regression test**: as requester, insert a status row with `changed_by` set to a different profile
  id and a status the request hasn't reached; assert rejection.
- **Integration-blocker status**: no.
- **Overlap risk with Bot 2**: moderate — `transport_status_history`'s own append-only *lock* (no
  update/delete) was already hardened, which could read as "this table is secure" without checking
  the INSERT `WITH CHECK` specifically.

### 6.6 — `buyer_applications.organization_id` not bound to the animal's real owning org — PII can be misrouted between competing organisations

- **Severity**: Medium.
- **Exact location**: `supabase/migrations/20260101001000_buyer_applications.sql` lines 9–66 — the
  buyer's `for all` INSERT/UPDATE policy checks only `buyer_id = auth.uid()`, never that
  `organization_id` matches `animals.organization_id` for the given `animal_id`. `submitApplication()`
  (`src/lib/queries/applications.ts` lines 78–100) inserts `organization_id` verbatim from client
  input. The org-owner SELECT policy (lines 57–66) trusts that same client-writable column.
- **Reachable actor**: any authenticated buyer submitting an application (or a party who can induce
  one, e.g. a modified request or a phishing clone of a real listing form).
- **Reproduction path**: submit an application for `animal_id` belonging to org A, with
  `organization_id` set to org B (which the buyer isn't applying to) — insert succeeds; org B's owner
  can then read the buyer's phone, `children_ages`, housing details, and message via their own
  legitimate org-owner SELECT policy.
- **Expected invariant**: an application's `organization_id` should always equal the referenced
  animal's actual owning org.
- **Observed behavior**: as above — enables lead-poaching between competing verified orgs, not just a
  display bug.
- **Smallest fix**: add to the `WITH CHECK`: `exists (select 1 from animals a where a.id = animal_id
  and a.organization_id = buyer_applications.organization_id)`, or derive `organization_id`
  server-side inside a `SECURITY DEFINER` RPC instead of trusting the client column.
- **Regression test**: as buyer, insert with `animal_id` belonging to org A but `organization_id` =
  org B; assert rejection; assert org B cannot select the row.
- **Integration-blocker status**: no.
- **Overlap risk with Bot 2**: moderate — the bug sits in a column that looks like normal FK data,
  not an obviously-sensitive actor/status column, so a keyword-driven sweep would likely miss it.

### 6.7 — `transport-evidence` storage bucket doesn't revoke driver access on cancellation, unlike its sibling `transport-documents` bucket

- **Severity**: Medium (corrects/extends §12's storage inventory, which verified
  reassignment-revocation but not cancellation).
- **Exact location**: `supabase/migrations/20260101010000_pickup_delivery_evidence.sql` lines 20–41
  (both `transport-evidence` INSERT and SELECT policies) gate solely on
  `is_assigned_driver_for_request()`, whose final definition
  (`supabase/migrations/20260101009800_driver_id_checks_active_role.sql` lines 29–43, confirmed live)
  has no `transport_requests.status` filter. The sibling `transport-documents` policy in the same
  file (lines 67–80) explicitly adds `tr.status not in ('draft','submitted','rejected',
  'cancelled_by_customer','cancelled_by_operations')`; `transport-evidence` never got the equivalent
  guard.
- **Reachable actor**: a driver previously assigned to a request later cancelled (by customer or ops)
  without being reassigned — `cancelMyTransportRequest()` (`src/lib/queries/transport.ts` lines
  772–776) only updates `status`, never `assigned_driver_id`, and no migration ever nulls it on
  cancellation.
- **Reproduction path**: driver assigned to request R; customer cancels R; `assigned_driver_id` still
  points at the driver; the driver can still `supabase.storage.from('transport-evidence').upload(...)`
  / `createSignedUrl(...)` for `R/...` indefinitely.
- **Expected invariant**: matches the already-applied `transport-documents` guard exactly.
- **Observed behavior**: as above. (Reassignment — as opposed to cancellation-without-reassignment —
  does correctly revoke access, since the join to the *new* driver's id fails for the old one; only
  the cancellation path leaks.)
- **Smallest fix**: add the same `tr.status not in (...)` clause to both `transport-evidence`
  policies, or centralize the check inside `is_assigned_driver_for_request()` so both sibling buckets
  inherit it.
- **Regression test**: assign driver, cancel the request without reassigning, assert the driver's
  evidence upload/sign calls now fail.
- **Integration-blocker status**: no.
- **Overlap risk with Bot 2**: low-moderate — the correct-looking reassignment behavior could cause a
  reviewer to conclude driver-access revocation "works" without separately testing cancellation.

### 6.8 — `approve_user_verification()` and the verification-rejection path have no audit trail

- **Severity**: Medium.
- **Exact location**: `approve_user_verification()`
  (`supabase/migrations/20260101009700_verification_approval_idempotency.sql` lines 17–90, full
  current version read) never inserts into `audit_logs`, despite creating an organisation row and
  activating a platform role — arguably the most consequential admin action in the schema. There is
  no `reject_user_verification()` RPC at all; rejection goes through a raw client update
  (`src/components/verification-review-list.tsx` lines 69–77, `.from("user_verifications").update({
  status: "rejected", notes: reason })`), gated only by the admin `FOR ALL` policy, with no trigger
  stamping `reviewed_by`/`reviewed_at` for this table.
- **Reachable actor**: any admin (this is a missing-observability gap, not unauthorized access).
- **Reproduction path**: approve or reject a verification through the normal admin UI; `select * from
  audit_logs where target_id = <verification id>` returns zero rows; for a rejection,
  `user_verifications.reviewed_by`/`reviewed_at` stay `null` permanently.
- **Expected invariant**: `CLAUDE.md` rule #13, "important status changes need an audit trail," and
  the pattern already used elsewhere (org-owner transfer, moderation decisions).
- **Observed behavior**: zero audit trail for approval; permanently-null `reviewed_by`/`reviewed_at`
  plus zero audit trail for rejection.
- **Smallest fix**: add an `audit_logs` insert inside `approve_user_verification()`; add a small
  `reject_user_verification()` RPC that stamps `reviewed_by`/`reviewed_at` and logs to `audit_logs`,
  replacing the raw client update.
- **Regression test**: after approval/rejection, assert a matching `audit_logs` row exists and (for
  rejection) `reviewed_by`/`reviewed_at` are set.
- **Integration-blocker status**: no.
- **Overlap risk with Bot 2**: low — this is an absence, not a bug in existing code, so it requires
  deliberately checking "is this logged" rather than reading what's already there.

### 6.9 — `uploaded_by` is forgeable on `transport_documents` and `welfare_case_documents`

- **Severity**: Medium.
- **Exact location**: `transport_documents.uploaded_by`
  (`supabase/migrations/20260101001400_transport_documents.sql` line 18) — the hardening trigger
  `prevent_requester_writes_to_document_review_fields()`
  (`supabase/migrations/20260101009600_transport_document_review_lock.sql` lines 28–76) locks
  `reviewed_by`/`reviewed_at`/`status` but never references `uploaded_by`. Same gap on
  `welfare_case_documents.uploaded_by` (`supabase/migrations/20260101007600_welfare_cases.sql` line
  124) — the org-membership `WITH CHECK` never validates `uploaded_by`.
- **Reachable actor**: any requester with insert rights to their own transport request's documents
  (or org member for welfare-case documents).
- **Reproduction path**: `submitDocument()` (`src/lib/queries/transport.ts` lines 465–490) takes
  `uploadedBy` as a plain input parameter and inserts it verbatim — a requester can set it to an
  arbitrary profile id, e.g. misattributing a compliance document's upload to staff.
- **Expected invariant**: matches the pattern already correctly applied to `reviewed_by`/`reviewed_at`
  in the same hardening migration.
- **Observed behavior**: as above.
- **Smallest fix**: stamp `uploaded_by := auth.uid()` server-side via a `before insert` trigger, same
  shape as the existing review-lock trigger.
- **Regression test**: insert a document with `uploaded_by` set to a different profile id; assert
  it's overridden/rejected.
- **Integration-blocker status**: no.
- **Overlap risk with Bot 2**: moderate — the hardening migration's name ("review lock") could read
  as "actor attribution on this table is handled" without checking which specific columns it covers.

## 7. Low findings

### 7.1 — `convert_application_to_reservation()` leaks a raw Postgres constraint name on the (correctly-prevented) double-sell race

- **Severity**: Low-Medium.
- **Exact location**: `supabase/migrations/20260101012300_convert_application_to_reservation.sql`.
  The function correctly relies on the pre-existing partial unique index
  `reservations_one_active_per_animal on public.reservations (animal_id) where status <>
  'cancelled'` (`20260101009400_concurrency_hardening.sql`) to prevent two different approved
  applications for the same animal from both becoming active reservations — this part is genuinely
  correct (independently verified: the index exists, live, and does cover the default
  `'awaiting_breeder'` status the new row is inserted with).
- **Observed behavior**: if a second application for the same animal is converted after a first one
  already has an active reservation, the function's own `EXISTS`-based "already converted" check
  (keyed on `application_id`, not `animal_id`) does **not** catch this case, so the `INSERT` proceeds
  and fails at the database level with a raw `23505 duplicate key value violates unique constraint
  "reservations_one_active_per_animal"` error — unlike every other rejection path in the same
  function, which raises a clean, business-friendly `P0001` message. This raw error (including the
  literal constraint/index name) would propagate to the ops/org user attempting the second
  conversion via PostgREST's default error passthrough.
- **Expected invariant**: matches this audit area's "raw SQL / constraint name" leakage category —
  every other guard in this exact function uses a clean `raise exception ... using errcode =
  'P0001'` message.
- **Smallest fix**: catch the unique-violation (`sqlstate '23505'`) around the `INSERT` and re-raise
  a clean message, e.g. "This animal already has an active reservation from a different
  application."
- **Regression test**: approve two applications for the same animal, convert the first, then attempt
  to convert the second — expect a clean, non-raw error message.
- **Integration-blocker status**: no.
- **Overlap risk with Bot 2**: low — this is a very new RPC (one of the newest migrations in the
  snapshot) and the underlying protection is non-obvious (an index defined 3000 migrations lines
  earlier), so it's easy to verify "duplicate reservations can't happen" and stop there without
  checking what error the caller actually sees.

### 7.2 — `rehoming_reviews` admin approval still has no `OLD.admin_status` guard (residual, low-impact after the notification-dedup fix)

- **Severity**: Low.
- **Exact location**: `supabase/migrations/20260101001200_rehoming_reviews.sql` lines 34–37,
  `"admins manage all rehoming reviews" for all using (is_admin()) with check (is_admin())` — no
  `OLD.admin_status` check.
- **Observed behavior**: two admins (or one admin double-clicking/retrying) approving the same
  review concurrently would both succeed at the RLS layer. The backend's own
  `20260101012100_notification_deduplication.sql` migration explicitly documents this exact gap
  ("approveRehomingReview() does a plain `.update()` with no `admin_status = 'pending'` guard") and
  fixes the *consequence* (duplicate notifications, via `dedup_key`) without fixing the underlying
  non-idempotent update. Since `admin_status='approved'` is otherwise a simple idempotent flag (no
  counter, no side-effect table write beyond the now-deduped notification), residual real-world
  impact is low.
- **Smallest fix**: add `and admin_status = 'pending'` to the admin policy's `USING` clause (matches
  `user_verifications`' own pre-decision guard shape).
- **Integration-blocker status**: no.

### 7.3 — `markDeletionRequestProcessed()`'s `declined` path accepts a client-supplied `processedBy`

- **Severity**: Low.
- **Exact location**: `src/lib/queries/privacy.ts`, `markDeletionRequestProcessed(id, status,
  processedBy)` — for `status === 'declined'`, does a raw `.update({ status, processed_at:
  new Date().toISOString(), processed_by: processedBy })` with `processedBy` passed in from the
  caller, not derived server-side.
- **Observed behavior**: low impact (`declined` has no downstream side effect), but inconsistent
  with the codebase's own general actor-stamping discipline, and the raw-update path shares the same
  table as §5.2/§6.3's broader "RLS doesn't restrict what an admin can write directly" gap.
- **Smallest fix**: stamp `processed_by = auth.uid()` server-side (trigger or a small RPC), consistent
  with the fix recommended for the `processed` path in §5.2.
- **Integration-blocker status**: no.

### 7.4 — ~127 unindexed foreign-key columns (pre-existing, documented, deliberate tradeoff)

- **Severity**: Low. Already tracked in `docs/TECH_DEBT_REGISTER.md` as a deliberate "wait for real
  usage data" decision, independently reasonable given local seed data can't distinguish genuine
  need from a guess. Not re-litigated in depth this pass; flagged only for completeness of the A10
  query/performance area.

### 7.5 — `getFriendlyErrorMessage()` sanitization layer built but wired into only 1 of 4 identified call sites

- **Severity**: Low.
- **Exact location**: `src/lib/errors.ts` — a real, well-designed Postgres-error-code sanitizer,
  built (per its own header comment) because several call sites were found doing
  `toast.error(error.message)` raw. `grep -rln getFriendlyErrorMessage src` shows exactly one
  consumer (`src/routes/_public.transport.request.tsx`); the three call sites the header comment
  names as motivation are still raw: `src/routes/_public.create-breeder.tsx:119`,
  `src/routes/dashboard.buyer.profile.tsx:132`, `src/routes/_public.reset-password.tsx:62`.
- **Reachable actor**: any user who triggers a constraint violation on those three forms (e.g. a
  duplicate-phone unique constraint on `profiles`).
- **Reproduction path**: trigger a unique/check-constraint violation on the buyer-profile-update or
  create-breeder form; observe the raw Postgres error text surfaced via `toast.error`.
- **Expected invariant**: the fix's own stated purpose — all three named call sites sanitized.
- **Observed behavior**: the fix exists but wasn't applied where its own commit said it needed to be.
- **Smallest fix**: wire `getFriendlyErrorMessage()` into the three remaining call sites.
- **Regression test**: frontend-only; a component test asserting sanitized text on a simulated
  constraint error would cover it.
- **Integration-blocker status**: no.
- **Overlap risk with Bot 2**: low — easy to miss since the sanitizer itself, read in isolation,
  looks complete and correct.

### 7.6 — `rpc-grant-hygiene.test.ts` doesn't assert the specific error it exists to catch

- **Severity**: Low.
- **Exact location**: `tests/db/rpc-grant-hygiene.test.ts` lines 14–40 — this file exists
  specifically to prove `revoke all ... from public` on certain RPCs is in place, but its assertions
  (`assert.ok(attempt.error)`, e.g. lines 19/24/32/39) only check that *some* error occurred, never
  the grant-level code (`42501`) nor use the suite's own `isForbidden()` helper (used correctly
  elsewhere, e.g. `recent-auth-step-up.test.ts`).
- **Reachable actor**: developer/CI — a test-suite integrity gap, not a live app bug.
- **Reproduction path**: the file's own comment (lines 6–8) notes the function body's internal role
  check would also reject an anonymous caller "either way" — so if a future migration accidentally
  dropped the `revoke ... from public`, this test would keep passing for the wrong reason, silently
  losing its entire purpose.
- **Expected invariant**: a test named "grant hygiene" should specifically assert the grant-level
  rejection it's testing for.
- **Observed behavior**: as above.
- **Smallest fix**: assert `attempt.error.code === '42501'` (or use `isForbidden()`) instead of a
  generic truthiness check.
- **Regression test**: this finding *is* the regression-test fix.
- **Integration-blocker status**: no.
- **Overlap risk with Bot 2**: low.

## 8. Areas verified adequate (with evidence)

- **RLS coverage**: 70/70 public tables have RLS enabled — confirmed **live** via `select count(*)
  filter (where rowsecurity) from pg_tables where schemaname='public'` (70/70), not just by reading
  migration text.
- **`SECURITY DEFINER` `search_path` pinning**: 76/76 currently-live `SECURITY DEFINER` functions
  pin `search_path` — confirmed live via `pg_proc.proconfig`, zero missing. (This is the
  deduplicated live count; a grep across migration history would over-count superseded `CREATE OR
  REPLACE` statements — 83 total public functions live, 76 of them `SECURITY DEFINER`.)
- **Secrets/config**: no committed API keys/service-role tokens/private keys anywhere in the tree
  (pattern scan across `*.ts`/`*.tsx`/`*.sql`/`*.toml`/`*.env*`, excluding `node_modules`); `.env`
  is not a tracked file (`git ls-files` confirms); `.env.example` has only empty placeholders;
  `src/lib/supabase/*.ts` never references a service-role key.
- **`profiles` contact-info protection**: verified **live** via `information_schema.column_
  privileges` — `authenticated` has no `SELECT` grant on `profiles.email`/`phone` at all (only
  `INSERT`/`UPDATE`/`REFERENCES`); `anon` has `SELECT` only on `id`/`display_name`/`avatar_url`/
  `city`/`country`. `get_my_profile()` is the only path back to your own contact details.
  `authenticated` bulk-read is genuinely blocked at the grant layer, not just by RLS.
- **`owns_org()` suspension handling**: current definition (`20260101006100_owns_org_checks_
  active_role.sql`) correctly requires the owner's role-appropriate platform role to still be
  `active`, not just row ownership — independently re-read, confirmed correct.
- **Driver active-role checks**: `is_my_driver_id()`/`is_assigned_driver_for_request()` (final
  versions, `20260101009800_driver_id_checks_active_role.sql`) both independently require
  `public.has_role(auth.uid(), 'driver')` in addition to the `profile_id` match — re-verified
  against the current file text myself (not merely trusting the prior pass's claim).
- **Moderation appeals column minimization**: `my_moderation_case_view` (definer-style, by design,
  since the base table's RLS is `using (false)` for the affected user) selects only 9 safe columns
  — no `report_id`/`assigned_moderator_id`/`decision_explanation` — independently confirmed by
  reading the view definition.
- **Storage tenant binding**: `transport-documents` and `transport-evidence` buckets' `storage.
  objects` policies both correctly scope on `(storage.foldername(name))[1]::uuid` matched against
  `is_assigned_driver_for_request()`/`requester_profile_id`, mirroring the same granularity as their
  respective DB-table RLS (no over-grant found — the DB table itself has no more granular
  per-document-category restriction the storage layer could be missing).
- **Signed URL expiry**: all 4 `createSignedUrl()` call sites (`transport.ts`, `welfare.ts`,
  `driver.ts`, `messaging.ts`) use a consistent 300-second expiry; the object path passed to each is
  always a value already fetched from a DB row the caller's own RLS already scoped, and Supabase
  Storage's `createSignedUrl` itself re-checks `storage.objects` RLS before minting a token, so an
  arbitrary/forged path argument would fail at signing time, not leak silently.
- **Public views' address privacy**: `public_transport_requests` uses only `pickup_area_approx`/
  `destination_area_approx`, never `*_address_exact`; `driver_transport_job_view` (the one place
  exact addresses do appear) is declared `security_invoker = true`, so the assigned driver's own
  row-level RLS on the base table still gates it — re-verified directly, matches the codebase's own
  documented reasoning.
- **Messaging abuse controls**: `messages`/`support_case_messages` both have a `char_length(body) <=
  10000` check; `messages.attachment_url` has a `CHECK` tying it to `conversation_id::text || '/%'`
  at the row level, independent of (and in addition to) the Storage-layer RLS check — genuine
  defense in depth, correctly reasoned in its own migration comment.
- **Fundraising simulated-payment invariant**: `fundraising_contributions`' insert policy hard-codes
  `is_simulated = true` in `WITH CHECK` — no raw API call can insert a non-simulated contribution;
  confirmed by reading the current policy text directly.
- **`convert_application_to_reservation()`'s core concurrency safety**: despite the error-leakage
  nuance in §7.1, the actual double-sell prevention is real and DB-enforced (not just
  application-level check-then-act), verified via the live partial unique index.
- **Migration hygiene baseline**: zero duplicate migration timestamp prefixes across all 126 files
  (`ls supabase/migrations | sed -E 's/^([0-9]+)_.*/\1/' | sort | uniq -d` → empty).
- **`app_maintenance_mode`**: single-row `check (id)` pattern; `enabled_by`/`enabled_at` are
  trigger-stamped from `OLD`/`auth.uid()` and explicitly re-stamped on every update that leaves
  `enabled = true` (not only the transition), closing the "same-value update slips a forged actor
  through" edge case — independently re-read and confirmed correct.
- **`risk_signals`**: no client INSERT/UPDATE grant at all (`grant select on ... to authenticated`
  only) — the only write path is `record_risk_signal()`, `SECURITY DEFINER`, never granted to
  `authenticated` directly, called only from other trusted contexts. Genuinely un-writable by a
  client, by construction, not just by convention.
- **Duplicate detection**: `animals.microchip_number` uses a real, hard, case/whitespace-insensitive
  unique index (unambiguous real-world identifier); transport-request duplicate submissions are
  correctly treated as advisory-only (`record_risk_signal()`, never auto-blocked) — a deliberate,
  well-reasoned distinction between the two, re-verified by reading both mechanisms directly. No
  race-condition concern in either (the fuzzy-match trigger only ever produces an advisory signal,
  never a blocking side effect, so a race changes at most whether a signal fires twice, not a
  security-relevant outcome).

## 9. Migration hygiene

126 migrations, no duplicate prefixes. Destructive-operation and existing-data-compatibility sweep
was performed by the delegated research pass (see §26 for exactly what was and wasn't independently
re-verified by the primary investigator within this area) — no `not null` column added without a
paired default was found by either pass. `SELECT *` usage is confined to internal `select * into
<record>` PL/pgSQL idioms (safe), never a client-facing wide select from a migration-defined view.
Views were read individually (§8) rather than as a blanket audit; all 7 public views' column lists
were checked against their base tables' protected columns with no leak found.

## 10. RLS and grant inventory

- 70/70 tables RLS-enabled (live-confirmed, §8).
- 206 total RLS policies on the `public` schema, 19 on `storage.objects` (live counts).
- **83 `FOR ALL` policies on the `public` schema** (live count) — the large majority are correctly
  the "trusted role manages everything" pattern (ops staff on transport tables, admins on
  reference/config tables, users on their own rows). A subset of these are the root cause of §5.2/
  §6.2/§6.3 — a table with a business-logic-bearing RPC in front of it should not also carry a
  blanket admin `FOR ALL`, or the RLS layer needs to independently enforce what the RPC enforces.
  Bot 2 should treat this as a category to sweep systematically (cross-reference every `SECURITY
  DEFINER` RPC with meaningful business logic against its underlying table's RLS), not just patch
  the 3 instances found this pass.
- Anon grants: table-level, `anon` gets only `REFERENCES`/`TRIGGER`/`TRUNCATE` on almost every
  table plus explicit column-level `SELECT` grants where intended (e.g. `profiles`,
  `public_*` views/tables) — the blanket `REFERENCES`/`TRIGGER`/`TRUNCATE` grant is present
  identically for `anon`/`authenticated`/`service_role` alike and is a Supabase platform-provisioned
  default (no migration in this repo grants it), not app-controlled, and not exploitable via
  PostgREST (which never exposes `TRUNCATE`/`TRIGGER`/`REFERENCES` as an HTTP operation) —
  independently confirmed by comparing grants across all 4 roles on a sample table (`profiles`) and
  finding the same three privileges present for `service_role` too, which rules out an app-migration
  origin.

## 11. `SECURITY DEFINER` inventory

76 of 83 live `public`-schema functions are `SECURITY DEFINER`; all 76 pin `search_path = public` in
`proconfig` (live-confirmed, zero exceptions). No broad `EXECUTE` grant to `public`/`anon` was found
on any sensitive `SECURITY DEFINER` function during either the primary investigator's spot checks or
the delegated pass — every sensitive RPC's `grant execute` is scoped to `authenticated` at most, with
role checks (`is_admin()`/`is_ops_staff()`/etc.) inside the function body itself. The one broad-grant
concern this pass found is **not** an over-broad `EXECUTE` grant but the opposite failure mode —
`create_notification_if_enabled()` (§5.3) has an appropriately-scoped `EXECUTE` grant
(`authenticated`, which is correct for a function every real user-facing flow needs to call) but
insufficient *internal* authorization logic for who it lets you notify.

## 12. Storage inventory

5 buckets, confirmed live via `storage.buckets`: `kennel-media` (public=true, 20MB),
`message-attachments` (private, 20MB), `transport-documents` (private, 20MB), `transport-evidence`
(private, 20MB), `welfare-case-documents` (private, 20MB). `transport-evidence` and
`welfare-case-documents` are new since the prior audit pass and were independently verified this
time: `transport-evidence`'s policies (`20260101010000_pickup_delivery_evidence.sql`) correctly gate
upload to the currently-assigned driver and read to the assigned driver + the request's own
requester, re-evaluated live on every call (not a point-in-time snapshot, so *reassignment*
correctly revokes/grants access dynamically). **Correction**: *cancellation without reassignment*
does **not** revoke access — see §6.7, a real gap the reassignment check above does not cover.
`kennel-media` correctly allows public `SELECT` (intentional — already-public marketing content) and
scopes writes to the owning org's path segment.
Storage-object upload rate limiting is a documented, accepted gap (`docs/TECH_DEBT_REGISTER.md`) —
`BEFORE INSERT` triggers on Postgres tables can't intercept direct Storage API uploads, and no
abuse has been demonstrated yet; not re-litigated as a new finding here.

## 13. Actor attribution

Spot-checked columns confirmed server-stamped and non-forgeable: `audit_logs.actor_profile_id`,
`notifications.actor_profile_id` (via `stamp_notification_actor()` trigger),
`transport_documents.reviewed_by`/`reviewed_at`,
`moderation_cases.assigned_moderator_id` (via `claim_moderation_case()`'s `for update` lock),
`support_cases.assigned_staff_id`, `risk_signals.reviewed_by`, `organisations.owner_user_id`/
`is_featured`/`verification_status` (via `prevent_org_owner_transfer_by_non_admin()`, which also now
writes a matching `audit_logs` entry atomically in the same trigger — `20260101011700`).
**Correction**: `route_assignments.assigned_by` was initially listed here as non-forgeable based on
reading `assign_request_to_route()` alone; it is not — the underlying table's RLS permits a raw
write that bypasses the RPC's stamping entirely. Moved to the forgeable list below; see §6.4.
**Confirmed forgeable** (new findings, not previously documented anywhere in this codebase's own
`DATABASE_INVARIANTS.md`): `legal_holds.placed_by`/`released_by`, `account_deletion_requests.
processed_by` (§5.2), `markDeletionRequestProcessed()`'s client-supplied `processedBy` on the
`declined` path (§7.3), `route_assignments.assigned_by` (§6.4),
`transport_status_history.changed_by` (§6.5), and `transport_documents.uploaded_by` /
`welfare_case_documents.uploaded_by` (§6.9).

## 14. State machines

- **Fundraising campaigns**: real status-skip, still live — §5.1.
- **Quotations**: partially-fixed terminal-state gap — §6.1.
- **`animal_ownership_history`**: not a state machine per se, but an append-only-shaped table with a
  mutability gap — §6.2.
- **`user_verifications`**: RPC-correct, RLS-bypassable — §6.3.
- **`legal_holds`/`account_deletion_requests`**: RPC-correct, RLS-bypassable, with reauth/audit
  consequences — §5.2.
- **`route_assignments`**: RPC-correct (`assign_request_to_route()`), RLS-bypassable — §6.4.
- **`moderation_cases`**: no OLD-state issue, but the resolution step has no conflict-of-interest
  guard, unlike its own appeal-review sibling — §5.4.
- **Driver transport status**: `prevent_non_staff_operational_field_changes()`
  (`20260101011100_driver_status_state_machine.sql`) enforces an explicit transition graph —
  independently re-read this pass, no skip/reversal path found.
- **Transport document review**: `20260101009600_transport_document_review_lock.sql` correctly locks
  an accepted document from all requester-side mutation, including `reviewed_by`/`reviewed_at`
  forgery — re-verified.
- **`buyer_applications`**: org-side transitions are intentionally unrestricted (the org is the
  trusted decision-maker for its own applications on its own animal — a legitimate design choice,
  not the same shape as the fundraising self-approval bug, since there is no separate approving
  party the org is bypassing); the buyer-side is correctly locked both at INSERT and UPDATE.
  `convert_application_to_reservation()` (new this session) correctly requires `status='approved'`
  first and is protected against duplicate reservations by a real unique index (§7.1's leak aside).
- **`welfare_cases`/`support_cases`**: both correctly guard `OLD.status` in their requester-side
  update policies (`status in ('draft','submitted','information_required')` /
  `status in ('resolved','closed')` respectively) — a real contrast with quotations' missing guard,
  confirming the team knows this pattern and applies it inconsistently rather than never.

## 15. Concurrency/idempotency

- **Correct, re-verified**: `reservations_one_active_per_animal` and
  `conversations_one_per_transport_request` partial unique indexes
  (`20260101009400_concurrency_hardening.sql`); `start_application_conversation()`'s advisory-lock
  pattern; `claim_moderation_case()`/`claim_support_case()`/`approve_user_verification()`'s `for
  update` row locks with a post-lock status re-check; `convert_application_to_reservation()`'s
  reliance on the pre-existing unique index (real, DB-enforced, just with a raw-error leak on the
  losing transaction, §7.1); `notifications_profile_dedup_key_idx` partial unique index plus
  `create_notification_if_enabled()`'s atomic insert-or-return-existing pattern (correct dedup
  mechanics, independent of the authorization gap in §5.3).
- **Gap**: `rehoming_reviews`' admin approval has no `for update`/`OLD.status` guard (§7.2, low
  residual impact after the notification-dedup fix closed the visible symptom).

## 16. Privacy

No exact-address, phone/email, reporter-identity, internal-note, or document-path leak found in any
public- or broad-authenticated-reachable policy or view this pass (re-verified independently, not
solely inherited from the prior pass — see §8's storage/view entries). **Correction**: one
application-answer leak *was* found and integrated post-commit — `buyer_applications.organization_id`
is client-writable and not bound to the referenced animal's real owning org, letting a buyer's
phone/`children_ages`/housing/message answers be routed to a different (competing) organisation than
the one they applied to — §6.6. `private_addresses` correctly scoped to owner/org/admin only.
`legal_holds`' reason/actor
fields are staff-only by RLS (though forgeable at the actor-column level per §5.2). Account
deletion's `execute_account_deletion()` genuinely anonymises (`display_name`/`first_name`/
`last_name`/`email`/`phone`/`avatar_url`/`city`/`country` all set `null`), and a legal hold does
correctly block it (checked as one more condition in the same function) — though, per §5.2, the hold
can itself be bypassed at the raw-table layer, which undermines the hold-propagation guarantee in
the one case that matters most (a malicious/compromised admin session).

## 17. Configuration/secrets

Clean — see §8. `FUNDRAISING_ENABLED` (`src/lib/fundraising-flag.ts`) is confirmed to be a pure
client-side UI gate with no server-side/RLS mirror, which is exactly why §5.1 remains reachable
regardless of the flag's state in any environment.

## 18. Error leakage

`raise exception ... using errcode = 'P0001'` is used consistently for business-rule rejections
across the schema (a real, deliberate, greppable convention, including a `reauthentication_required:`
message prefix specifically for step-up failures). The one confirmed raw-error leak found this pass
is §7.1 (`convert_application_to_reservation()`'s unhandled unique-violation on the animal-level
double-sell race) — narrow, low-frequency, and does not itself constitute a security issue (only an
information/polish one). A separate, frontend-side error-leakage gap was also found: a sanitization
layer built specifically to fix this class of issue exists but is only wired into 1 of the 4 call
sites its own commit message identifies — §7.5.

## 19. Query/performance

Not this pass's deepest area (see §26 Limitations) — `docs/TECH_DEBT_REGISTER.md`'s own
~127-unindexed-FK-columns item (§7.4) was read and accepted as a reasonable, already-documented
tradeoff rather than re-litigated. `public_routes`' capacity computation and the public views in
general use bounded, indexed-appropriate queries; no unpaginated client-facing query was confirmed
as newly-broken this pass.

## 20. Frontend conflicts

Independently re-run directly by the primary investigator (not solely relying on the delegated
agent, whose fuller output was not confirmed collected before this report was finalized — see §26).
Method: `git merge-base 9b16b98 origin/ux-marketplace-frontend-pass` → `02e64163d2162024968bf0e
79d6aa999af57ac63` (same merge-base the prior four-hour pass used), then for each of the 76 files
the frontend branch touches relative to that base, checked whether the *current* backend snapshot
has any commit on the same file after that base (i.e. real independent post-divergence editing, not
shared pre-existing history). 33 backend commits since the merge-base touch `src/lib/queries`/
`src/routes` in total; 9 specific files show genuine co-modification:

| File | Post-divergence backend commit(s) | Risk |
|---|---|---|
| `src/lib/queries/marketplace.ts` | 3 commits | High — same file/functions the prior pass already flagged as independently rewritten on both sides for the same N+1 fix; still live. |
| `src/lib/queries/buyer-activity.ts` | 1 commit | High — same pairing as `marketplace.ts` (touched together historically). |
| `src/lib/queries/profile.ts` | 1 commit | Low-moderate — prior pass's assessment (pure end-of-file appends, different region than the frontend's edits) likely still holds; not re-diffed line-by-line this pass. |
| `src/routes/dashboard.buyer.transport.tsx` | 1 commit | High — same file the prior pass flagged (the real transport-timeline feature); still live risk. |
| `src/routes/dashboard.buyer.quotations.tsx` | 1 commit (`5cc520f`, this session's own newest quotation-expiry-warning UI change, §6.1) | **New since the prior pass** — not previously flagged. Needs a combined read during integration, not a default "one side wins" rule. |
| `src/routes/_public.planned-routes.tsx`, `_public.transport.index.tsx` | 1 commit each (`293648d`, "retire the hand-written Supabase types stub") | Low — a generated-types-only mechanical commit, not a logic change; likely auto-merges cleanly, but not independently diffed line-by-line to confirm. |
| `src/routeTree.gen.ts` | 3 commits | None if handled correctly — both sides' own conventions already say never hand-merge this generated file. |
| `package.json` | 2 commits | Low — dependency/script-only, standard auto-mergeable shape per the prior pass's assessment. |

**New, not in the prior pass**: `dashboard.buyer.quotations.tsx` is a genuinely new co-modification
risk introduced by this session's own newest commit (`5cc520f`) — flag it for the same "manual
combined read, not the default rule" treatment already recommended for `dashboard.buyer.
transport.tsx`. The core finding from the prior four-hour pass (real, ongoing co-modification risk
on the marketplace/buyer-activity/transport-timeline cluster) is independently reconfirmed, not
resolved, three sessions later.

## 21. Test quality

Time-boxed direct checks by the primary investigator (the delegated agent's fuller pass was not
confirmed collected — see §26): `tests/db/legal-holds.test.ts` (133 lines, fully read) only ever
exercises the RPC path for `place_legal_hold`/`release_legal_hold`, never a raw-table insert/update
attempt — meaning the existing test suite would not catch §5.2 even by accident. 56 `*.test.ts`
files exist under `tests/db/` (57 total files including `helpers.ts`). This suite uses `node:test`/
`node:assert/strict`, not a Jest-style framework, so the prior pass's "`toBeTruthy()`-only" weak-
assertion check doesn't directly translate; the nearest analog, `assert.ok(...)`, appears 265 times
across the suite against 870 uses of a real value comparison (`assert.equal`/`deepEqual`/`match`) —
`assert.ok` is used correctly in the samples read (asserting an error occurred, alongside real
value checks elsewhere in the same test), not as a blanket substitute for a real assertion, but this
ratio was not verified file-by-file across all 56 files. 22 files use `Date.now()` for test-data
uniqueness (up from 17 at the prior pass's snapshot — expected, given 8 more migrations/test files
landed since); not independently re-triaged this pass for genuine collision risk vs. the
`createTestTransportRequest()` shared-helper pattern the prior pass found already closes the one
concrete case that mattered. One concrete weak-assertion instance was confirmed via the delegated
agent's fuller pass and integrated post-commit: `tests/db/rpc-grant-hygiene.test.ts` asserts only
generic error truthiness where it specifically needs to check for a `42501` grant-level rejection —
see §7.6.

## 22. Background jobs

No cron/queue/outbox system exists anywhere in this codebase — repeatedly, explicitly confirmed by
the backend session's own progress notes (Stage BA, CJO, IR-10) and independently spot-checked by
grepping for `job`/`queue`/`cron`/`outbox`/`dead_letter` across all 126 migrations, finding no such
table or scheduled-execution mechanism. Every "staleness" concern in this schema (document/vehicle
expiry, quotation expiry) is instead handled by computing staleness on read (`documentExpiryWarning()`
in `transport.ts`, `expiryWarnings()` in `fleet.ts`, and now the RLS-level expiry check added in
`20260101012400`) — a deliberate, consistently-applied design choice, not an oversight, and
correctly not flagged as a missing-background-job bug.

## 23. Recommended Bot 2 fix order

1. **§5.1 — fundraising `active` self-set.** Highest severity, smallest fix, already has a proven
   template in the same file (`target_reached`/`partially_funded`).
2. **§5.2 — `legal_holds`/`account_deletion_requests` raw-write bypass.** High severity, defeats a
   deliberately-built security control; fix by revoking the unnecessary table grants (smallest
   change) and sweep the same `FOR ALL`-admin-vs-RPC pattern across `user_verifications` (§6.3),
   `route_assignments` (§6.4), and `user_consents` (§5.2's systemic-pattern note) in the same
   migration, since the fix shape is identical in every case — revoke the unnecessary
   `insert`/`update` grant from `authenticated` wherever a `SECURITY DEFINER` RPC already fronts the
   table.
3. **§5.3 — `create_notification_if_enabled()` authorization gap.** High severity, real
   phishing/spam vector reachable by every user; fix at the primitive so all 4+ producers inherit it.
4. **§5.4 — `moderation_cases` self-resolution conflict-of-interest gap.** High severity, live via
   the real UI today (not behind a feature flag, unlike §5.1); smallest fix mirrors
   `review_moderation_appeal()`'s existing self-review guard.
5. **§6.1 — quotation terminal-state guard.** Independent of the above.
6. **§6.2 — `animal_ownership_history` immutability**, bundled with **§6.3** (`user_verifications`
   grant fix, if not already folded into #2) — low implementation risk, proven pattern.
7. **§6.5 — `transport_status_history` forged `changed_by`/`status`** and **§6.9 — `uploaded_by`
   forgery** on `transport_documents`/`welfare_case_documents` — same actor-stamping fix shape,
   worth one combined migration.
8. **§6.6 — `buyer_applications.organization_id` cross-org binding** and **§6.7 —
   `transport-evidence` cancellation-revocation gap** — independent of each other but both
   real, live, currently-reachable gaps; prioritize ahead of the Low-severity items below.
9. **§6.8 — verification approval/rejection audit-log gap.** Observability-only, no urgency beyond
   normal backlog.
10. **§7.1–7.6** — low priority; §7.1 (clean error message) and §7.2 (`rehoming_reviews` OLD-status
    guard) are cheap wins worth bundling with an earlier migration in this list; §7.3–§7.6
    opportunistic (§7.5/§7.6 are pure frontend/test-file changes, no migration needed).

## 24. Reproduction commands

All commands assume a `supabase-js` client authenticated as the actor named in each finding (or the
equivalent raw PostgREST `curl` call with the actor's JWT in the `Authorization` header).

```js
// §5.1 -- fundraising self-publish (as the eligible org's owner)
await supabase.from('fundraising_campaigns').update({ status: 'active' }).eq('id', myDraftCampaignId);

// §5.2 -- legal hold raw bypass (as any admin, regardless of session age)
await supabase.from('legal_holds').insert({ subject_profile_id: targetUserId, reason: 'x', placed_by: otherAdminId });
await supabase.from('account_deletion_requests').update({ status: 'processed', processed_by: otherAdminId }).eq('id', requestId);

// §5.3 -- notification spoofing (as any authenticated user)
await supabase.rpc('create_notification_if_enabled', {
  p_profile_id: victimId, p_category: 'moderation', p_notification_type: 'account_alert',
  p_title: 'URGENT: verify your account', p_body: 'Click here', p_link_url: 'https://attacker.example',
});

// §6.1 -- quotation terminal-state reopening (as the transport request's requester)
await supabase.from('quotations').update({ status: 'accepted' }).eq('id', quotationId);
await supabase.from('quotations').update({ status: 'rejected' }).eq('id', quotationId); // succeeds; should be rejected once already decided

// §6.2 -- animal_ownership_history admin mutation (as an admin)
await supabase.from('animal_ownership_history').delete().eq('id', someHistoryRowId);
```

```bash
# Read-only live-DB introspection used throughout this audit (safe to re-run)
docker exec supabase_db_the-puppy-passport psql -U postgres -d postgres -c \
  "select count(*) filter (where rowsecurity), count(*) from pg_tables where schemaname='public';"
docker exec supabase_db_the-puppy-passport psql -U postgres -d postgres -c \
  "select tgname from pg_trigger where tgrelid='public.legal_holds'::regclass and not tgisinternal;"
```

## 25. Delta audit against latest committed source

- Phase 1 snapshot: `9b16b98ef25343ea31ace7f39b24d72ed61492a1`.
- Phase 2 snapshot: `359e0f3bba34ddb1d886f3e62bffb57cbad6f463` (`git -C
  /p/the-puppy-passport rev-parse HEAD`, fetched into this clone as `audit/latest-source`, source
  worktree never entered).
- `git log --oneline 9b16b98..359e0f3`: two commits — `4ee25d0` "Notify appellants when a moderation
  appeal is decided" (Stage IR-10) and `359e0f3` (progress-log-only commit).
- `git diff --stat`: 6 files changed, 248 insertions, 12 deletions — `docs/AUTONOMOUS_BACKEND_
  PROGRESS.md`, `src/lib/notification-templates.ts`, `src/lib/queries/moderation.ts`,
  `src/routes/dashboard.admin.moderation.tsx`, `tests/db/moderation-appeals.test.ts`,
  `tests/db/notification-template-versioning.test.ts`. **No migration file changed** — no new SQL,
  no new RLS/grant surface.
- **Independent review of the delta**: adds a 4th producer (`notifyAppellantOfAppealDecision()`) on
  top of the existing `create_notification_if_enabled()` primitive, following the exact same
  "await the RPC, then make a second client call to notify" shape already used by the other 3
  producers (`notifyAffectedUserOfDecision`, etc.) — not a new architectural pattern. The new call
  site is correctly sequenced *after* `reviewModerationAppeal()` succeeds (which is itself
  moderator-gated and includes a "moderator cannot review their own original decision" check per the
  existing test file), so it does not introduce a new way to trigger a *false* decision — but it
  does inherit §5.3's pre-existing authorization gap unchanged: the underlying primitive still lets
  any authenticated user call it directly with an arbitrary recipient/content, independent of
  whether a real appeal was ever reviewed. **Conclusion: this delta does not introduce a new
  regression; it adds a 4th caller to an already-flawed shared primitive, reinforcing §5.3's
  priority (fix once at the primitive, not per-caller).** New tests
  (`tests/db/moderation-appeals.test.ts`) correctly verify dedup/preference/exactly-once-delivery
  mechanics for the new producer but do not test unauthorized-caller rejection (consistent with
  §5.3 being untested project-wide, not a new gap specific to this commit).
- No further source movement was observed after re-fetching at the end of this audit
  (`git -C /p/the-puppy-passport rev-parse HEAD` unchanged at `359e0f3` on the final check).

## 26. Limitations

- **No destructive DB verification run.** A local Supabase/Docker instance was reachable, but it is
  a shared instance tied to the real project (not exclusive to this audit clone) and was confirmed
  already synced to the real backend's own migration history. Given the hard "do not modify the real
  backend" constraint and the risk of colliding with concurrent work (Bot 2 or other processes), this
  audit deliberately did not run `supabase db reset`, `test:db`, `tsc`, or `build` against it —
  those all either mutate data or (for `tsc`/`build`) would require a fresh `npm install` in the
  clone, which was judged lower-value than the SQL/RLS depth work given the time available. Read-only
  `psql` introspection (RLS/grant/`SECURITY DEFINER`/storage/trigger inventories) was used instead
  and is called out explicitly wherever it was the basis for a claim ("live-confirmed"). This means
  every exploit repro in this report is confirmed correct by direct policy-text/live-catalog
  tracing, not by empirically firing the request against a running API layer end-to-end (i.e., the
  RLS/grant logic was verified, but not the full PostgREST HTTP request/response round-trip).
- **Two mid-audit interruptions (session/budget resets).** Four research agents were originally
  delegated to cover the breadth areas (A4/A5/A13/A15 state machines/concurrency/domain
  boundaries/jobs; A6/A7/A16 storage/privacy/public contracts; A1/A3/A8/A9/A10/A14 migration
  hygiene/actor attribution/config/error leakage/performance/audit; A11/A12 frontend contracts/test
  quality). After the first interruption they were successfully resumed from their transcripts with
  no apparent loss. A second interruption occurred before their full structured findings were
  collected and integrated into this document; rather than risk a third uncommitted loss, this
  report was finalized and committed on the primary investigator's own direct findings plus the
  quick, targeted checks done after the second resume (§5–§10, most of §8's "verified adequate"
  list, and the maintenance_mode/duplicate_detection/legal_consent_versioning/risk_signals spot
  checks above), per explicit direction to prioritize a committed, mostly-complete report over
  continuing to dig. **This means A11 (frontend contracts) and A12 (test quality) in this document
  reflect only the primary investigator's own narrower, time-boxed direct checks (§20/§21) — not
  the fuller breadth those two delegated agents were tasked with — and should be treated as the
  least-covered areas in this report, not "verified clean."** A10 (query/performance) is similarly
  shallow (§19), consistent with it being explicitly deprioritized in this audit's own brief.
  Everything reported in §5–§10 and the additions above was personally traced through the exact
  current SQL/live catalog by the primary investigator, not inherited from an unreviewed
  delegated-agent claim.
- **Backend's own docs were used as a map, never as evidence** — every claim from
  `docs/AUTONOMOUS_BACKEND_PROGRESS.md`/`docs/TECH_DEBT_REGISTER.md`/`docs/DATABASE_INVARIANTS.md`
  that fed into a finding or a "verified adequate" conclusion was independently re-checked against
  the actual current SQL; `DATABASE_INVARIANTS.md`'s server-stamped-actor list was directly useful
  here — its *absence* of `legal_holds`/`account_deletion_requests` from that list, combined with
  live trigger introspection confirming no such lock exists, is part of the evidence for §5.2, not
  just a coincidence noticed in passing.
- **No performance/EXPLAIN analysis** — consistent with the prior pass, the backend's own documented
  "wait for real usage data" position on unindexed FKs was read and accepted, not re-litigated.
- **Post-commit supplemental integration pass.** After this report's first commit, the four
  delegated research agents' full structured transcripts (which the primary investigator's own note
  above says were "not confirmed collected" at finalization time) were in fact retrieved by the
  coordinating session and cross-checked line-by-line against what had already been committed.
  §5.4, §6.4–§6.9, and §7.5–§7.6 were added as a result — each independently traceable to specific
  file/line evidence in those transcripts, none invented. §6.4 additionally corrects a factual error
  in the original §13 (`route_assignments.assigned_by` was wrongly listed as non-forgeable). This
  means A11/A12's caveat above (§20/§21 reflecting only the primary investigator's narrower checks)
  still stands as written for those two areas specifically — the supplemental pass focused on
  concrete, previously-unintegrated findings from the A1/A3/A4/A5/A6/A7/A13/A14/A16 agents, not on
  redoing the A11/A12 breadth work.

## 27. Final snapshot hashes

- Phase 1 source snapshot audited: `9b16b98ef25343ea31ace7f39b24d72ed61492a1`.
- Phase 2 (delta) source snapshot audited: `359e0f3bba34ddb1d886f3e62bffb57cbad6f463`.
- Frontend reference: `ux-marketplace-frontend-pass` (remote-tracking ref, inspected read-only, never
  checked out).
- Audit clone: `/p/the-puppy-passport-bot1-audit-20260725-175844`, branch
  `audit/bot1-backend-20260725-175844`.
