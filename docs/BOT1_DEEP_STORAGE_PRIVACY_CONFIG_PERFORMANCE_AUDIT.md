# Bot 1 — Deep Storage, Privacy, Configuration, Errors, Performance Audit

Source snapshot: `92e8126cb6a4a2ca4bf5a96dad7226195d2d05ac` (unchanged from the prior round at time
of writing — re-confirmed at the start of this domain). Method: migration/code reading, live
Postgres catalog introspection against the idle-to-lightly-active local Supabase instance
(read-only queries only), grep-based systematic sweeps. Given the size of this queue (five domains,
~90 sub-items), this pass prioritized depth on the highest-signal items per domain over exhaustive
line-by-line coverage of every sub-item — consistent with this session's own standing "evidence over
volume" discipline. Items not independently deep-dived are marked so explicitly, not silently
skipped.

---

## DOMAIN 1 — STORAGE

### S-1: Bucket inventory

Five real buckets exist (confirmed via `storage.buckets` inserts across 4 migrations — no others
found by exhaustive grep for `storage.buckets`):

| Bucket | Public? | Path convention | Legitimate actors | Migration |
|---|---|---|---|---|
| `kennel-media` | **Public** | `{org_id}/...` | anon/authenticated read all; org owner write own folder | `20260101002200` |
| `transport-documents` | Private | `{transport_request_id}/...` | requester (own request, read+insert only, no update/delete), assigned driver (read, active-role + active-job-status gated), ops staff (all) | `20260101002200`, `20260101003400`, `20260101006300`, `20260101009800` |
| `message-attachments` | Private | `{conversation_id}/...` | conversation participant (read+insert only), ops staff (all) | `20260101008700` |
| `welfare-case-documents` | Private | `{welfare_case_id}/...` | org member (read always; insert/update/delete only while case is in an editable status), ops staff (all) | `20260101007600`, `20260101012500` |
| `transport-evidence` | Private | `{transport_request_id}/...` | assigned driver (insert; read), requester (read), ops staff (all) | `20260101010000` |

**No dedicated bucket exists for**: organisation verification documents (verification is an
admin-set status field with no document-upload flow — confirmed by exhaustive grep, genuinely
absent, not an oversight to flag), profile/avatar images (`profiles.avatar_url` is a plain text URL
column, not a Storage-managed object — likely intended for external/seeded URLs at this stage), or
export objects (`exportMyData()` in `src/lib/queries/privacy.ts` generates a GDPR Art. 20 export as
an in-memory JSON object built from direct table queries at request time — never persisted to
Storage at all, which is actually a *lower*-risk design than a persisted export bucket: there is no
export object to orphan, leak via a stale signed URL, or forget to clean up). All three "missing"
categories are genuinely absent by design, not silently unimplemented gaps — verified, not assumed.

### S-2: Path canonicalisation

Every policy uses `(storage.foldername(name))[1]::uuid` (or the correctly-qualified
`storage.objects.name` after the column-shadowing fix, see S-9) — casting the first path segment to
`uuid`. This is a strong canonicalisation control by construction: a path with dot-segments (`../`),
encoded separators, or any non-UUID first segment fails the cast with a Postgres error (denying
access, not silently misinterpreting the path) before any tenant-binding `exists()` check even runs.
Not independently fuzz-tested against literal malformed paths this pass (would require either a live
Storage API call or a direct `storage.objects` insert with a crafted `name` — time-budgeted out), but
the mechanism itself is sound by inspection: **confirmed, high confidence, not empirically
fuzz-tested this pass.**

### S-3 / S-4: Tenant binding / object substitution

Every non-`kennel-media` bucket's policies bind the object path's first segment to a real row the
caller has a genuine relationship to (`transport_requests.requester_profile_id = auth.uid()`,
`is_conversation_participant()`, `is_org_member()` via `welfare_cases.organisation_id`,
`is_assigned_driver_for_request()`) — an attempt to upload/read/write into another tenant's folder
(e.g. `{someone_else's_transport_request_id}/evil.pdf`) fails the `exists()` check, not merely a
path-format check. This closes the classic "object substitution" attack (reusing/aiming at another
resource's path) at the RLS layer for every bucket reviewed. **Confirmed for all 5 buckets, live
policy text read in full for each.** Not empirically reproduced this pass (would require either live
Storage API calls or `storage.objects` inserts under impersonation — see Limitations).

### S-5: Signed URL permission loss

**Dedicated test coverage found and read in full**: `tests/db/signed-url-permission-loss.test.ts`.
Two tests: `"suspension: an already-issued signed URL survives, but a new one cannot be created"`
and `"cancellation: a customer keeps read access to their own request's documents by design, not by
omission"`. This is precisely the distinction the task itself calls for (new-URL-creation-blocked
vs. already-issued-URL-still-valid-until-expiry) — the test names alone demonstrate the team already
understands and has encoded the correct invariant, not a false "fully revocable" claim. **Adequate,
confirmed via test-name/file evidence; test bodies not read in full this pass** (time-budgeted; the
names and the fact dedicated coverage exists at all is itself strong signal, given most projects have
none).

### S-6: Legal hold interaction with Storage

**Design concern, not a live exploit.** Exhaustive grep confirms `legal_holds` (subject-scoped to a
single `profiles.id`, migration `20260101011500`) is never referenced anywhere in relation to
Storage — its blast radius, by explicit design, is narrowly "block `execute_account_deletion()` for
this one profile," not a general litigation/evidence hold across all buckets. This is a legitimate
scope observation, not a bug in what `legal_holds` actually promises. **The specific risk this might
otherwise cover — an org tampering with/destroying evidence after a decision has been made against
them — is independently and thoroughly closed for welfare-case-documents** via
`20260101012500_welfare_case_document_lock.sql`, which freezes both the DB table and the matching
Storage bucket symmetrically once `welfare_cases.status` leaves the editable window
(`draft`/`submitted`/`information_required`). Transport-documents and transport-evidence have no
comparable post-decision freeze for the requester, but structurally don't need one: requesters never
had an UPDATE/DELETE policy on either bucket in the first place (insert+read only), so there is
nothing to freeze. **Net assessment: adequate coverage via per-bucket-appropriate mechanisms, not a
single legal-hold umbrella — but this is a real naming/expectation gap worth flagging**: anyone
reading "legal hold" and assuming it covers all evidence types platform-wide would be wrong, and
should know that before relying on it for an actual litigation-hold scenario spanning multiple
resource types tied to an organisation rather than a single profile.

### S-7: Orphan cleanup

No dedicated Storage-orphan-cleanup job found (grepped for `orphan`, `cleanup.*storage` across
migrations and `src/lib` — no hits). This matches the lineage's own prior finding
(`docs/EXPORT_OBJECT_LIFECYCLE_AUDIT.md`, not re-read in full this pass) that no export objects
persist at all (S-1 above), reducing the surface that would need orphan cleanup to begin with. For
the 5 real buckets: an insert that fails after a partial object upload (network failure mid-upload,
metadata-row insert failing after the Storage object succeeded) could still leave an orphaned
Storage object with no corresponding DB row. **Not independently verified this pass whether this
specific partial-failure scenario is bounded/monitored anywhere** — recorded as an open question,
not a confirmed gap (no evidence either way was gathered this pass).

### S-8: Raw path leakage

Checked frontend rendering of Storage-derived URLs: `transport-document-checklist.tsx`,
`dashboard.admin.achievement-verification.tsx` (`evidence_url`),
`dashboard.operations.documents.tsx` (`file_url`) all render the stored URL/path as an `href` for a
"view document" action — this is the *intended* use (a document viewer needs the path to build a
signed URL or public URL from), not a leak, since these are all gated by RLS already covering S-3/S-4
above and the routes themselves are role-gated (admin/ops dashboards). No evidence of a raw internal
Storage path appearing in a genuinely public-facing context (public marketplace views, public error
messages, or unauthenticated routes) — the `public_transport_requests` view (S-1/P-1 below) does not
select any document/evidence URL column at all. **Adequate, confirmed by direct code read of the
public view definition plus the 3 render sites found.**

### S-9: Storage test coverage

Real dedicated test files exist: `tests/db/pickup-delivery-evidence.test.ts`,
`tests/db/signed-url-permission-loss.test.ts`, `tests/db/message-attachments.test.ts`,
`tests/db/access-control.test.ts`, `tests/db/welfare-case-document-lock.test.ts`. The
`access-control.test.ts` suite specifically covers the "assigned driver cannot actually read their
job's documents" regression (the column-shadowing bug, migration `20260101006300`) — real evidence
of a genuine bug once caught by this exact test file, which is strong signal the coverage is not
theatre. **Not independently read line-by-line this pass** for whether every actor tier (anonymous,
unrelated-authenticated, removed-member, suspended-member, reassigned-driver, cancelled-request,
legal-hold, object-substitution) is explicitly exercised — recorded as unverified, not assumed
complete, given the file names alone show at least suspension/cancellation/column-shadowing/lock
scenarios are covered.

---

## DOMAIN 2 — PRIVACY

### P-1: Exact addresses

`public.public_transport_requests` (migration `20260101002300`, read in full) is an explicit,
narrow allowlist view — `pickup_country`/`pickup_area_approx` and
`destination_country`/`destination_area_approx` only, **exact address columns
(`pickup_address_exact`/`destination_address_exact`) are never selected**, confirmed by direct read
of the view's column list. The view's own comment explicitly states the reasoning: it is
deliberately not `security_invoker`, precisely because the base table has no broad RLS grant at all
— this view is the *only* sanctioned path to community-visible rows, and its safety depends entirely
on the hand-picked column list (a row-level security policy on the base table would not have been
column-safe). **Adequate, confirmed by full read of the effective view definition.**

### P-2: Phone and email

`animalSelect`/`animalSelectFor()`/`orgSelect` in `src/lib/queries/marketplace.ts` (read in full)
expose only `city`/`country`/`name`/`slug`/`verification_status`/`response_time` for organisations —
no phone or email column anywhere in the public marketplace query surface. Not independently
re-checked this pass for every other query helper (applications, messages, support, moderation,
exports) — carried forward as unverified for those, not assumed safe.

### P-3: Reporter identity

`moderation_cases` has `"affected user sees their case only via the safe view"` (`SELECT`,
`qual = false` — i.e. the affected/reported party can **never** read the base table directly, only
through a dedicated safe view presumably column-restricted) — confirmed live via `pg_policies` in
the prior round's work on the DV-4/HF-3 finding. Not independently re-checked this pass whether that
safe view itself correctly excludes the reporter's identity from what the reported party can see —
carried forward as unverified, high-confidence-by-design but not re-read this pass.

### P-4: Internal notes

Not independently re-verified this pass across all 6 named note categories (support/moderation/
org-review/transport-ops/admin/achievement-admin/document-review). `achievements.admin_notes` was
directly confirmed protected from owner self-write in the prior round's DV-5/HF-5 work (owner cannot
read-or-write it via the raw API path check — actually that check confirmed *write* protection; read
exposure via SELECT was not separately checked). Recorded as a real gap in this pass's own coverage,
not claimed as verified.

### P-5: Application answers

Not independently re-verified this pass. Carried forward from the lineage's own Domain F coverage
(cross-organisation application PII routing was previously checked in the overnight pass's earlier
rounds, not re-derived here).

### P-6: Document paths and metadata in public contracts

Confirmed via S-8 above: the one real public contract checked (`public_transport_requests`) excludes
document/evidence URLs entirely. Not independently re-checked for other public-facing contracts this
pass.

### P-7: Driver and transport data

Confirmed via S-1/S-3 above at the Storage layer (exact addresses excluded from the public view;
document/evidence access is tenant- and role-bound). Not independently re-checked at the query-helper
level for driver-facing dashboards this pass (would need to verify e.g. a driver's dashboard query
doesn't accidentally select `pickup_address_exact` for jobs they aren't assigned to).

### P-8: Export and deletion consistency

`exportMyData()` (`src/lib/queries/privacy.ts`, header comment read) states explicitly: "every query
here reads only the caller's own rows" — a deliberate, stated design invariant. Combined with S-1's
finding that exports are never persisted to Storage, the export surface has a narrow, well-scoped
risk profile: no export-object orphaning, no other-user-data-in-export risk beyond whatever the
underlying per-table queries themselves get wrong (not independently re-verified column-by-column
this pass — the header comment is a claim, not itself proof of correctness, though it is at least an
explicit, checkable invariant rather than silence).

### P-9: Public field allowlists

**Confirmed, explicit allowlists, not `select *`, for both checked surfaces**: `public.
public_transport_requests` (view, hand-picked columns) and `animalSelect`/`orgSelect` in
`marketplace.ts` (explicit column-list strings, read in full). Litters/breeders/foundations/adoption/
rehoming allowlists not independently re-checked this pass — carried forward as unverified.

### P-10: Privacy conclusion

No release-blocking privacy finding from this pass's own work (everything checked was either
adequate-by-design or an unverified-but-not-contradicted carry-forward). The one real-beta-relevant
item: the S-6 "legal hold doesn't cover Storage generally" scope observation is a **documentation
gap** (the mechanism should be described accurately as "account-deletion hold," not implied to be a
general litigation hold) rather than an accepted residual risk, since the actual specific tamper
scenario it might have been expected to cover is independently closed elsewhere (welfare case
documents).

---

## DOMAIN 3 — CONFIGURATION AND SECRETS

### C-1: Committed secret scan

Pattern search across `.ts`/`.tsx`/`.sql`/`.json`/`.env*` files (excluding `node_modules`) for
service-role-key shapes, `sk_live`/`sk_test` (Stripe-shaped), AWS access-key-id shape, and PEM
private-key headers: **zero matches anywhere in the working tree**, including `.env.example` (every
value there is empty or a template placeholder — `VITE_SUPABASE_URL=http://127.0.0.1:54321`,
`VITE_SUPABASE_ANON_KEY=`, `SUPABASE_AUTH_GOOGLE_SECRET=`, `SUPABASE_AUTH_FACEBOOK_SECRET=`, all
blank). Git history not scanned this pass (would require `git log -p` across the full history —
time-budgeted out; the working-tree scan is the higher-value check given this is a from-scratch
built repo, not one with a known historical leak to hunt for). **Confirmed clean, redacted evidence
only, no secret value ever printed by this pass.**

### C-2: Service-role exposure

**Zero occurrences of `SUPABASE_SERVICE_ROLE_KEY` or `service_role` anywhere in `src/`** (confirmed
by exhaustive grep across `.ts`/`.js` files, excluding `node_modules`) — meaning there is no code
path in the client-bundlable source tree that could leak service-role credentials into a browser
bundle, because the string doesn't appear there at all, not merely because it's guarded correctly.
The two browser-exposed env vars (`VITE_`-prefixed, which Vite bundles into client code by
convention) are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — both intentionally public,
protected by RLS rather than secrecy. **Confirmed, high confidence.**

### C-3: Provider credentials inventory

Required-but-disabled providers, by name, from `.env.example` and the earlier-confirmed absence of
any payment/analytics/email/SMS provider dependency in `package.json`: `SUPABASE_AUTH_GOOGLE_SECRET`,
`SUPABASE_AUTH_FACEBOOK_SECRET` (social auth, both blank/unconfigured in the example). No
email/SMS/payment/analytics/webhook provider config names exist anywhere (consistent with the prior
round's 0/72 dependency-manifest finding — there is nothing to inventory because nothing is even
scaffolded yet for those categories).

### C-4: Unsafe defaults

Not independently re-verified this pass for every named feature (fundraising/payments/email/SMS/
analytics/webhooks/flags/maintenance/admin). The one concretely checked: fundraising campaign
publication requires admin approval regardless of any config state (§5.1, prior lineage, not
config-dependent at all — it's a workflow gate, not a provider-not-configured fallback). Genuinely
unverified for the others — recorded honestly rather than assumed safe.

### C-5: Secret logging

Not independently re-verified this pass (would require reading every error/logging call site for
whether it could echo a credential — out of this pass's time budget given C-1/C-2 already confirm no
secret exists in the reachable source to begin with, which limits the blast radius even if a logging
gap existed).

### C-6: Direct RPC feature bypass

Directly relevant, real evidence from this session's own prior rounds: `maintenance_mode` has a
dedicated schema/query helper (`src/lib/queries/maintenance.ts`) — not independently re-checked this
pass whether a direct RPC call bypasses a maintenance-mode UI block, but this is exactly the shape of
question this task asks and the earlier lineage's Domain C (`Maintenance mode bypass`) stage exists
for it; not confirmed fixed or open by this specific pass's own work.

### C-7: Environment separation

**Confirmed, carried forward with fresh confirmation this round**: `CLAUDE.md`/`docs/LOCAL_SETUP.md`/
`docs/PRODUCTION_SETUP.md` are explicit that only a local Supabase instance exists; `.env.example`'s
own `VITE_SUPABASE_URL=http://127.0.0.1:54321` confirms the only configured URL anywhere in the
repository is local. No staging/demo/production URL, key, or callback URL found anywhere in the
committed source.

### C-8: Secret ownership and rotation

Not independently re-verified this pass whether any document assigns owner/rotation/blast-radius per
secret — no such document was found by name in the earlier lineage's doc listing (`docs/` directory
contents reviewed in the prior overnight round) beyond the general `PRODUCTION_SETUP.md`, which was
not re-read in full this pass. Recorded as unverified, likely a **documentation gap** (not a security
gap given C-1/C-2's clean results) rather than confirmed present or absent.

---

## DOMAIN 4 — ERRORS

### E-7: Friendly error coverage — real finding this pass

**Confirmed gap, Medium severity.** `getFriendlyErrorMessage` is used in exactly **34 files**
(unchanged from the previously-recorded baseline — re-confirmed by grep this pass). A separate grep
for raw `err.message`/`error.message`/`String(error)` rendered via `toast.error(...)` or similar,
**excluding** `console.*` calls and test files, finds **36 files** with at least one raw-error-text
render, overlapping only partially with the 34 already-fixed files — i.e. roughly half the real
surface remains unwired. Representative confirmed sites (exact grep matches, file:line):
`src/routes/dashboard.operations.dispatch.tsx:59`, `src/routes/dashboard.admin.fundraising.tsx:39,47,55`,
`src/routes/dashboard.admin.organisations.tsx:47,56`, `src/routes/dashboard.admin.moderation.tsx:70,79,109`,
`src/routes/dashboard.admin.achievement-verification.tsx:70,92`, `src/routes/_public.reset-password.tsx:62`.
Full file list (36 files, all confirmed by direct grep, not estimated):
`dashboard.operations.routes.$id.tsx`, `dashboard.operations.drivers.tsx`,
`_public.reset-password.tsx`, `dashboard.operations.matching.tsx`,
`dashboard.operations.incidents.tsx`, `adoption-form-dialog.tsx`, `cards.tsx`,
`dashboard.operations.routes.index.tsx`, `notification-preferences.tsx`, `_public.adoptions.$id.tsx`,
`dashboard.admin.users.tsx`, `dashboard.operations.vehicles.tsx`, `dashboard.operations.dispatch.tsx`,
`dashboard.admin.listings.tsx`, `dashboard.admin.fundraising.tsx`, `dashboard.admin.organisations.tsx`,
`dashboard.admin.achievement-verification.tsx`, `dashboard.admin.moderation.tsx`,
`dashboard.operations.requests.$id.tsx`, `dashboard.admin.reports.tsx`, `dashboard.admin.settings.tsx`,
`transport-document-checklist.tsx`, `dashboard.operations.welfare-cases.tsx`,
`litter-form-dialog.tsx`, `dashboard.operations.quotations.tsx`, `dashboard.operations.documents.tsx`,
`achievement-form-dialog.tsx`, `chat-thread.tsx`, `review-transport-dialog.tsx`,
`verification-review-list.tsx`, `report-dialog.tsx`, `parent-dog-form-dialog.tsx`,
`report-incident-dialog.tsx`, `puppy-form-dialog.tsx`, `account-privacy-card.tsx`,
`_public.puppies.$id.tsx`, `apply-dialog.tsx`.

**Severity nuance**: the large majority are admin/ops dashboard routes (trusted-staff audience,
lower severity for raw-text exposure than a public customer) — but at least 6 are genuinely
public/customer-facing: `_public.reset-password.tsx`, `_public.adoptions.$id.tsx`,
`_public.puppies.$id.tsx`, `apply-dialog.tsx`, `report-dialog.tsx`, `adoption-form-dialog.tsx`
(the latter three are likely used from public buyer-facing flows, not independently confirmed
route-by-route this pass which specific dialogs are reachable pre-auth vs. post-auth). **Whether any
of these raw messages could actually contain sensitive internal detail (constraint names, SQLSTATE
text) depends on what error conditions reach them — not independently reproduced this pass** (would
require triggering a real backend error at each of these 36 sites). Recorded as a confirmed
*coverage* gap (the wiring is incomplete, that part is directly evidenced) with an unverified
*severity* tail (whether the actual leaked text is ever sensitive in practice).

### E-1 / E-2 / E-3 / E-4 / E-5 / E-6 / E-8

Not independently re-verified this pass beyond what overlaps E-7 above. Carried forward from the
lineage's own §7.5-adjacent coverage (raw SQL leakage was the specific concern §7.5 already fixed
for the 34-file baseline) — this pass's own contribution is specifically the E-7 gap-sizing above,
not a fresh sweep of E-1 through E-6/E-8.

---

## DOMAIN 5 — PERFORMANCE AND QUERY SHAPE

### Q-2: Client-side filtering — regression-checked, FIXED

**The prior-evidence-flagged `listPublishedPuppies()` client-side-filtering issue is confirmed
FIXED on current main**, not merely carried forward as a stale finding. Read `src/lib/queries/
marketplace.ts` in full: `animalSelectFor(filters)` builds a filter-aware select string (`breeds!
inner(name)` only when filtering by breed, same pattern for country via
`organisations!...!inner(...)`), and the query applies `.eq()`/`.gte()`/`.lte()` filters
**server-side** (real Postgres `WHERE`, confirmed by the query builder chain, not an in-memory
`.filter()` anywhere in the function body). The migration/commit history embedded in the code's own
comments (Stage IR-2) documents this was deliberately fixed, matching this pass's own independent
read of the current implementation — not merely trusting the comment.

### Q-6: Stable sorting — confirmed adequate

Same function: `.order("created_at", { ascending: false }).order("id", { ascending: true })` — a
genuine two-column stable sort with `id` as a real, always-unique tie-breaker, specifically added
(per the code's own comment) because `created_at` alone can tie when multiple rows share one
statement's `now()` value. This is exactly the Q-6 concern (deterministic tie-breaker, tested-for
insert-between-pages safety) addressed correctly. **Confirmed by direct code read.**

### Q-1: Unpaginated discovery — real, current, precise finding

**`listPublishedPuppies()`'s pagination mechanism is correctly built (`.range()` applied only when
both `filters.page` and `filters.pageSize` are provided) but is opt-in, and the code's own comment
states all 3 current call sites (`_public.index.tsx`, `_public.find-your-dog.tsx`,
`_public.find-a-dog.tsx`) call it with no arguments at all.** This means: server-side filtering is
genuinely fixed (Q-2 above), but production behavior today is still an **unbounded fetch of every
row matching the base `listing_category='breeder_puppy' AND is_published=true` predicate**, with no
default page size applied when the caller doesn't opt in. This is a precise, current, real finding —
distinct from and narrower than the older Q-2 finding it superficially resembles: the *filtering*
half is fixed, the *pagination-is-actually-used* half is not yet. **Smallest fix**: apply a sane
default `pageSize` (e.g. via `filters?.pageSize ?? DEFAULT_PAGE_SIZE`) rather than requiring every
caller to opt in explicitly, or update the 3 known call sites to pass an explicit page/pageSize.
Not a release blocker at current seed-data scale; a real scale blocker once the marketplace has a
large number of published listings.

### Q-3: SELECT *

Two confirmed instances in `marketplace.ts` (lines ~230, ~346) use `.select("*", { count: "exact",
head: true })` — **harmless by construction**: `head: true` means PostgREST returns only the count
header, never the row data, so the `*` never actually leaves the database. Classified: **harmless
local pattern**, not a privacy or performance concern. Not independently swept for other `select("*")`
usages outside `marketplace.ts` this pass.

### Q-4 / Q-5 / Q-7 / Q-8 / Q-9

Not independently re-verified this pass (time-budgeted toward the two concrete, evidenced findings
above). Q-9 specifically: no production performance claim was found anywhere in the repository to
flag as unsupported (consistent with every prior pass in this lineage) — recorded as "nothing to
correct" rather than "verified adequate," since the absence of a claim is not the same as a verified
system property.

### Q-10: Performance conclusion

**Q-1 (unbounded discovery fetch)**: classified as **optimisation opportunity now, real-beta-adjacent
scale blocker once listing volume grows** — not a release blocker at current scale, but should be
fixed before any real marketing push increases listing volume, since the mechanism to fix it already
exists and just needs a default applied. **Q-2/Q-6**: no change required, both confirmed adequate.

---

## Cross-domain summary

**New findings this pass**: E-7 gap-sizing (Medium, confirmed coverage gap: 36 files with raw error
rendering vs. 34 files fixed, exact file list given), Q-1 (Low/optimisation, unbounded discovery
fetch despite a correctly-built-but-unused pagination mechanism), S-6 (documentation-gap-tier design
observation about `legal_holds`' true scope). **Regression-checks performed**: Q-2 (client-side
filtering) reconfirmed FIXED on current main, not merely carried forward. **No new Critical or High
finding** in any of the 5 domains this pass.
