# Bot 1 — Latest High Finding Register

Authoritative, single-page register for the 5 open High findings plus the previously-fixed findings
that must be regression-checked going forward. Supersedes scattered per-report detail for quick
reference; full evidence trail remains in `docs/BOT1_OVERNIGHT_FINALISATION_AUDIT.md` §12 and the
prior lineage reports cited throughout. Latest committed `main` HEAD reviewed as of writing this
register: `ac612690c1741d7879d747f7e13b40fd0cb2cc04` (the `ac61269→e8cf707` delta is reviewed
separately immediately after this file — see the delta-verification section appended below once
reviewed).

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
- **Current status**: **Open**, live-reconfirmed `ac612690`.
- **Candidate fix status**: None exists yet for this finding specifically.
- **Required Bot 2 correction**: remove the `accepted_by_customer` exemption clause from the
  trigger (or replace it with a check that the transition only happens through the RPC, e.g. a
  session-local guard flag set only inside `respond_to_quotation()`), forcing customers through the
  RPC for this transition the same way they already are for every other status transition.
- **Required regression test**: (a) requester raw `UPDATE` cannot set `accepted_by_customer` even
  when `old.status='quotation_sent'`; (b) expired quotation cannot be accepted (raw or RPC);
  (c) missing/nonexistent quotation cannot be accepted; (d) terminal request cannot be reopened via
  this path; (e) concurrent raw update cannot race ahead of the RPC (serializable/row-lock check);
  (f) unrelated payload fields cannot be smuggled in the same PATCH as the status transition;
  (g) canonical `respond_to_quotation()` acceptance still functions end-to-end; (h) calling
  `respond_to_quotation()` twice for the same request is idempotent/safe. Grants must be checked
  separately from the trigger/RLS layer (i.e. confirm `authenticated` UPDATE grant + RLS + trigger
  all independently deny the raw path, not just one layer).
- **Release-blocker status**: Yes — sits on the core launch-scope quotation-acceptance flow.
- **Integration-blocker status**: No known frontend conflict tied to this specific finding.
- **Remaining risk if unfixed**: a customer can force a transport request into an accepted state
  without the RPC's associated side effects (whatever `respond_to_quotation()` does beyond the bare
  status flip — e.g. notifying ops, locking the quotation, writing status history) potentially never
  running, leaving downstream state inconsistent.

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
- **Current status**: **Open**, live-reconfirmed `ac612690`.
- **Candidate fix status**: None exists yet.
- **Required Bot 2 correction**: revoke direct `authenticated` EXECUTE on this function; require
  callers to go through trusted producer functions/RPCs that independently derive/authorize
  `p_profile_id` (e.g. only allow it when the caller has a legitimate relationship to the recipient
  — same org, same conversation, same transport request, etc.), or make the function
  `SECURITY INVOKER` and gate recipient selection through RLS on the underlying insert.
- **Required regression test**: (a) ordinary user cannot select an arbitrary recipient;
  (b) arbitrary title/body/link cannot be sent; (c) actor cannot be spoofed in the resulting audit/
  notification row; (d) raw EXECUTE grant denial asserts the correct SQLSTATE (`42501` or similar),
  not a generic error; (e) legitimate producer call sites (grep every existing caller) still work
  after the grant/wrapper change; (f) user notification preferences still suppress opt-out
  categories; (g) mandatory security notifications remain mandatory (not suppressible); (h) existing
  deduplication (`p_dedup_key`) still works; (i) rate limits recover correctly after a burst;
  (j) retried calls don't duplicate a customer-visible notification.
- **Release-blocker status**: Yes — zero-privilege phishing primitive.
- **Integration-blocker status**: No known frontend conflict; frontend does not call this RPC
  directly with attacker-controlled recipients in the intended UI, but the raw API is reachable
  regardless of UI behavior.
- **Remaining risk if unfixed**: platform-hosted phishing against any user, using a channel the
  victim trusts (in-app notifications), with the real Havenpaw sender identity.

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
- **Current status**: **Open**, live-reconfirmed `ac612690`.
- **Candidate fix status**: `7ba7b32` exists (finalisation clone only,
  `/p/the-puppy-passport-bot1-finalisation-20260727-235034`,
  `candidate-fixes/bot1-legal-hold-deletion-raw-write-20260727`). Conceptually correct — revokes
  `authenticated` raw insert/update on `legal_holds` and narrows `account_deletion_requests`' RLS to
  SELECT+INSERT-only for self-service, plus tightens the admin policy's `WITH CHECK` to forbid raw
  `status='processed'`. **Staleness**: real migration-filename collision with
  `supabase/migrations/20260101013600_admin_command_audit_coverage.sql`, which exists on real `main`
  at that exact prefix — re-confirmed present in this exact clone by direct `ls`. **Must not be
  applied as-is; needs renumbering to an unused prefix first.**
- **Required Bot 2 correction**: apply the same narrowing `7ba7b32` demonstrates, under a new,
  collision-free migration filename; add recent-reauthentication enforcement to the sensitive
  transition if not already present; ensure actor fields on the resulting audit trail are
  server-derived, not client-supplied.
- **Required regression test**: (a) raw insert/update/delete denied where intended, allowed only for
  the legitimate self-service subset (create + view own); (b) recent-auth step-up enforced for the
  sensitive transition; (c) actor fields server-derived; (d) deletion-blocker-graph checks can't be
  bypassed by going raw; (e) audit events are written for the canonical RPC path; (f) canonical
  `execute_account_deletion()` RPC remains functional end-to-end; (g) grant-level denial asserts the
  correct SQLSTATE; (h) legal holds still propagate to the deletion/cleanup paths they're supposed to
  block (cross-check against the already-fixed FA-4 finding, which specifically closed a
  `buyer_applications` self-delete gap in the same area — confirm no new gap reopens it).
- **Release-blocker status**: Yes.
- **Integration-blocker status**: No known frontend conflict.
- **Remaining risk if unfixed**: a user can force their own account-deletion request into a
  processed-equivalent state without the RPC's anonymisation/blocker-graph checks ever running,
  potentially leaving inconsistent data or bypassing a legal hold that should have blocked deletion.

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
- **Current status**: **Open**, live-reconfirmed `ac612690`.
- **Candidate fix status**: None exists yet.
- **Required Bot 2 correction**: add a conflict-of-interest exclusion to the moderator `ALL` policy
  (e.g. `is_moderator() AND reported_profile_id IS DISTINCT FROM auth.uid() AND
  <any other conflict field> IS DISTINCT FROM auth.uid()`), or route resolution exclusively through
  an RPC that performs this check server-side before allowing the write.
- **Required regression test**: (a) moderator can't claim/dismiss/resolve a case naming themselves;
  (b) can't review their own appeal of that case; (c) raw table update can't bypass the rule even
  with a crafted payload; (d) an independent (non-conflicted) moderator can still decide the case
  normally; (e) if admin override is allowed for conflicted cases, it requires a reason and produces
  an audit record; (f) reporter identity stays private to the conflicted moderator throughout (cross-
  check against the `SELECT qual = false` safe-view policy already in place).
- **Release-blocker status**: Yes.
- **Integration-blocker status**: No known frontend conflict.
- **Remaining risk if unfixed**: a moderator under investigation, or reported by a user, can clear
  their own case — a direct integrity failure of the moderation system.

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
- **Current status**: **Open**, live-reconfirmed `ac612690`.
- **Candidate fix status**: `3f4db66` exists (finalisation clone only, same branch as `7ba7b32`).
  Adds a before-insert-or-update trigger requiring `is_admin()` for any transition to
  `verification_status = 'approved'`, mirroring the identical fix shape Bot 2 has already shipped
  twice for the same bug class (`organisations.verification_status`, `20260101011700`;
  `fundraising_campaigns.status`, `20260101014000`). **Staleness re-checked this pass**: content
  still correct against `ac612690`; **no filename collision** (confirmed again by `ls` in this
  clone against the same migration directory checked for `7ba7b32`) — safe to apply as a file
  pending Bot 2's own testing.
- **Required Bot 2 correction**: apply `3f4db66` (or an equivalent admin-gated trigger) as-is.
- **Required regression test**: (a) achievement owner can't approve/verify their own achievement;
  (b) can't forge reviewer metadata (if any `reviewed_by`/`reviewed_at` columns exist); (c) ordinary
  content edits (title/description/date, non-status fields) still work for the owner; (d) admin
  review still works end-to-end and is audited; (e) raw table update to `'approved'` is denied for
  non-admins (grant/RLS/trigger layers all independently checked), or safely locked once set.
- **Release-blocker status**: Yes — public trust-signal integrity.
- **Integration-blocker status**: No known frontend conflict (not reachable through the real UI
  today, so a fix has zero frontend impact).
- **Remaining risk if unfixed**: any org can self-award a "verified" badge with zero admin review,
  directly undermining a public trust signal the marketplace surfaces to buyers.

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
| `submit_transport_request` atomicity and saved-draft submission | `20260101006700_create_transport_draft_rpc.sql` / related dispatch RPCs | The RPC remains atomic (all-or-nothing); submitting a previously-saved draft updates the existing row in place rather than creating a duplicate; request actor (`requester_profile_id`) remains server-derived, not client-suppliable; status history is written exactly once per transition, not duplicated on retry |

---

## Register maintenance note

This register is updated at each delta-verification checkpoint (Phase 3 of the current task) as
each finding's status changes. See `docs/BOT1_OVERNIGHT_FINAL_HANDOFF.md` for the broader pass
history this register sits within, and the delta log appended to this same `docs/` directory (or
inline below, once the first delta is reviewed) for the exact commit-by-commit verification trail.
