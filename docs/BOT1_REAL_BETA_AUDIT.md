# Bot 1 — Real-Beta Readiness Audit (VA-01..VA-60)

Folded into the overnight audit clone (`/p/the-puppy-passport-bot1-overnight-20260728-233809`,
branch `audit/bot1-overnight-20260728-233809`) per coordinator instruction — not a new clone, not a
new audit start. Source snapshot: `ac612690c1741d7879d747f7e13b40fd0cb2cc04` (unchanged from the
rest of this pass — see `docs/BOT1_OVERNIGHT_FINALISATION_AUDIT.md` §1–2).

**Environment disclosure (applies to every VA-05..VA-14 browser-proof stage below):** this
environment has no live browser/automation tool available to this pass (no Playwright driver
invoked, no screenshot capability exercised). Every "browser proof" stage below is answered via
route/component/query code reading only, and is explicitly labelled **"cannot fully verify — no
live browser session available; verified via code reading only"** rather than claimed as browser
proof. This matches the task's own explicit instruction to disclose rather than fabricate.

## VA-01 Beta scope truth
Not independently re-derived this pass. `docs/PRODUCTION_READINESS_REPORT.md` (carried forward,
read by prior lineage passes) is the authoritative ready/partial/blocks-launch breakdown. This
pass's own contribution: the 5 open High findings (§12 of the main overnight report) are all in
code paths that *are* part of the intended beta scope (transport quotation acceptance, account
deletion, achievement verification, moderation case handling, notifications) — i.e. these are not
edge features, they sit on core beta-scope flows. **Partial** — scope-vs-proof comparison not fully
re-derived, but the intersection with open Highs is real and evidenced.

## VA-02 Demo/real data separation
Not independently re-derived this pass. `supabase/seed.sql` exists and is the only seed source
(carried forward from lineage's `FIXTURE_DETERMINISM_AUDIT.md` coverage). No new evidence this pass.
**Unverifiable this pass** — carried forward, not re-checked.

## VA-03 / VA-04 Import security / import abuse
**Confirmed absent this pass**, not assumed: `grep -rliE "csv|bulk.?import|\.import\b"` across
`src/` and `supabase/migrations/` returns zero matches. No CSV/structured bulk-import functionality
exists anywhere in the codebase. **N/A — verified absent.**

## VA-05 Browser auth proof
Cannot fully verify — no live browser session available; verified via code reading only.
`src/lib/auth/actions.ts` (signUp/signIn/signOut), `src/lib/auth/session.ts` (`getCurrentUser`),
`src/routes/_public.forgot-password.tsx` exist and were read by prior lineage passes (Domain C
role-matrix coverage). Not independently re-read line-by-line this pass.

## VA-06 Browser public proof
Cannot fully verify — no live browser session available; verified via code reading only. Public
marketplace contract (Domain D in the lineage) covers discovery/filter/detail/privacy at the
query-layer; SEO metadata not independently re-derived this pass (see VA-42 below for the one
concrete check performed).

## VA-07–VA-12 Browser buyer/organisation/transport/operations/support/moderation proof
Cannot fully verify — no live browser session available; verified via code reading only, and only
where it intersects this pass's own live-DB work (§12 of the main report: transport quotation
acceptance and moderation case claim are the two flows this pass has fresh, live-confirmed evidence
for, both showing the *raw-API* path is exploitable regardless of what the UI itself allows — i.e.
UI-level correctness would not close either finding). The remaining flows (application, save/follow,
messaging, animal creation, publication gates, exact-address access, documents, evidence, timeline,
completion, internal notes, reopen, appeal, reporter privacy) were not independently re-driven this
pass. Carried forward from lineage Domain E/F/G/H/I/J coverage.

## VA-13 Accessibility proof
Not independently re-derived this pass (no automated a11y scan run, no live browser). Carried
forward as unverified by this pass; lineage's own Domain P a11y stages not confirmed re-run either.

## VA-14 Responsive proof
Same as VA-13 — not independently re-derived this pass, no live browser/viewport testing performed.

## VA-15 Polish language proof
Not independently re-derived this pass — out of this pass's time budget. No grep-level check
performed for Polish-locale copy quality specifically.

## VA-16 Consent registry proof
**Real, positive finding this pass** — read in full:
`supabase/migrations/20260101010200_legal_consent_versioning.sql`. `legal_document_versions`
(terms/privacy/cookies, versioned, `unique(document_type, version)`, a partial unique index
enforcing at most one `is_current=true` row per document type) + `user_consents`
(`profile_id`, `document_type`, `version`, `consented_at`, `unique(profile_id, document_type,
version)`). RLS: users can `SELECT` only their own consent history; **no UPDATE/DELETE policy
exists for ordinary users at all** — consent history is append-only/immutable by construction. The
self-service `INSERT` policy's `WITH CHECK` requires the referenced version to actually be the
current published `is_current=true` row for that document type — a user cannot record consent to an
arbitrary/forged version string. **Adequate** — this is real, evidenced, live-checkable structure,
not documentation-only. The migration's own comment is honest that the seeded "current" version is
labelled `-draft` because `/terms` and `/privacy` are still pending lawyer review
(`docs/PRODUCTION_READINESS_REPORT.md`) — the *mechanism* is real regardless of the legal text's own
maturity.

## VA-17 Consent-change proof
**Adequate**, evidenced by the same migration read for VA-16: publishing a new "current" version is
a new row in `legal_document_versions` (admin-only `is_admin()`-gated policy), which does not and
structurally cannot mutate any existing `user_consents` row (no update/delete path exists for that
table at all, for any role except direct superuser/service-role). Updated terms/privacy text
therefore cannot silently overwrite historical acceptance — a new version requires a new consent
record, and old consent records remain exactly as they were. Not live-DB re-confirmed this pass
(structural/migration-text evidence only, high confidence given the RLS shape already confirmed live
for other tables in this pass's own §12 method — same author, same pattern, not independently
re-run against the live catalog for this specific table this pass).

## VA-18 Analytics privacy proof
**N/A — confirmed absent.** No analytics provider dependency exists (0/72 `package.json` deps match
any analytics signature — same check as the main overnight report §7/§8). No events to audit for PII
because no event pipeline exists.

## VA-19 Operational metrics proof
Not independently re-derived this pass. No SLO claims were found or asserted by this pass; nothing
to flag as fake.

## VA-20 / VA-21 Backup truth / restore proof
Not independently re-derived this pass. `docs/BACKUP_AND_DISASTER_RECOVERY.md` exists (confirmed
present by listing, prior lineage passes read it under Domain O). Not re-read in full this pass —
carried forward, unverified whether its local-vs-external-backup distinction is accurate.

## VA-22 / VA-23 Credential leak / account takeover readiness
Not independently re-derived this pass. `docs/INCIDENT_RUNBOOKS.md` exists (confirmed present by
listing). Not re-read in full this pass.

## VA-24 Support taxonomy
Not independently re-derived this pass. `docs/SUPPORT_OPERATIONS_BOUNDARY_AUDIT.md` exists
(confirmed present by listing). Not re-read in full this pass.

## VA-25 Moderation playbook
Directly relevant to this pass's own H-3 finding (§12 of the main report): the live RLS shape
(`is_moderator()` ALL policy, no self-conflict exclusion) means whatever playbook text exists cannot
be enforced technically — a conflicted moderator's raw-API access is not blocked regardless of
playbook guidance. **Gap confirmed live, same underlying finding as H-3.**

## VA-26 Transport incident playbook
Not independently re-derived this pass.

## VA-27 / VA-28 Customer communication truth / status communication
Not independently re-derived this pass.

## VA-29 Entitlement enforcement
**N/A — confirmed absent** in the billing/package sense: no `entitlement`/`subscription`/
`billing_plan`/`package_tier` schema exists (grep across migrations and `src/lib` returns only one
unrelated hit — `20260101007200_transport_draft_animal_entitlement_check.sql`, which enforces a
per-draft *animal-count* limit on transport drafts, not a commercial package entitlement). No
commercial packages exist yet, so there is nothing to bypass-test at the billing level.

## VA-30 / VA-31 Subscription state design / billing idempotency
**N/A — confirmed absent**, same basis as VA-29 and the main report §7.

## VA-32 / VA-33 Refund boundary / invoice boundary
**N/A — confirmed absent**, no payment surface exists to have a refund/invoice boundary around.

## VA-34 Fraud controls
Partially covered by existing lineage findings: `docs/RATE_LIMITING_AND_ABUSE_PROTECTION.md` exists
(confirmed present by listing); messaging/verification abuse controls were covered by prior lineage
Domain C/E/J stages (not independently re-derived this pass). Billing/fundraising fraud controls are
N/A (no money movement exists — fundraising is publication-only per `docs/FUNDRAISING_POLICY.md`).

## VA-35 / VA-36 Lead capture privacy / CRM minimisation
**N/A — confirmed absent.** No lead-capture or CRM integration exists anywhere in the dependency
manifest or schema.

## VA-37 Sales truth
Not independently re-derived this pass — no sales collateral exists in the repository to check
against the product (consistent with the lineage's own conclusion that Domain U is essentially
unstarted).

## VA-38 Onboarding reproducibility
Not independently re-driven end-to-end this pass (would require either a live browser or a full
RPC-sequence dry run, neither performed this pass). `docs/LOCAL_SETUP.md` exists and was read by
prior lineage passes for the *developer* setup path (distinct from *organisation* onboarding, which
is the product flow VA-38 actually asks about). **Unverified this pass.**

## VA-39 Customer success metrics
Not independently re-derived this pass. No fabricated values found (nothing to fabricate — no such
metrics section exists in the repository).

## VA-40 Demo truth
Not independently re-derived this pass — no live browser/product-tour run performed.

## VA-41 Landing-page truth
Not independently re-derived this pass. Overlaps with Domain D (public marketplace contract),
carried forward unchanged (no backend delta touches it this round).

## VA-42 SEO readiness
**Completed this pass — real finding SEO-1 (Low).** 30 of `src/routes/_public.*.tsx` define a real
TanStack Router `head()` producing dynamic (loader-data-driven, not hardcoded) `<title>`/
`<meta name="description">` — confirmed by reading `_public.puppies.$id.tsx` and
`_public.breeders.$slug.tsx` in full; `__root.tsx` sets a sane default. **Absent**: canonical
`<link>` tags (zero anywhere in `src/`), robots meta tags (zero `noindex` anywhere),
`robots.txt`/`sitemap.xml` (neither file exists anywhere in the repo). Low severity, not
launch-blocking; real duplicate-content/crawl-budget risk once the marketplace has live,
filterable/paginated traffic. Full detail: `docs/BOT1_MARKETING_AND_SALES_TRUTH_REVIEW.md`.

## VA-43 Performance claim truth
No production performance claims found anywhere in the repository to flag as unsupported —
consistent with lineage's Domain O coverage (local-only query-plan checks, no marketed benchmark
claims present).

## VA-44 Email boundary
**N/A — confirmed absent.** No email provider dependency exists (same 0/72 check).

## VA-45 Domain/DNS plan
Not independently re-derived this pass. No claim changes were applied (this pass made zero writes
to any external system, per the task's own hard constraints).

## VA-46 Environment separation
Real, existing evidence carried forward: `docs/LOCAL_SETUP.md` / `docs/PRODUCTION_SETUP.md` /
`CLAUDE.md` (read at the start of this pass, see the system context) are explicit that only a local
Supabase instance exists, no production project is configured — a clean, honest environment
boundary. **Adequate**, not independently re-verified beyond the CLAUDE.md text already surfaced to
this pass.

## VA-47 Secret ownership
Not independently re-derived this pass. `.env.example` exists in this clone (confirmed by the
initial `ls`); not read in full this pass to confirm it contains no real values (prior lineage
passes' secret-scan stage, Domain A, is the relevant carried-forward evidence).

## VA-48 Controlled rollout
`docs/MAINTENANCE_DEGRADATION_AUDIT.md` and the `maintenance_mode` schema/`src/lib/queries/
maintenance.ts` exist (confirmed present by grep this pass — see the entitlement/feature-flag grep
above). Not independently re-read in full this pass to assess kill-switch/rollback/audit quality.

## VA-49 Feedback workflow
Not independently re-derived this pass.

## VA-50 Change management
Carried forward: `docs/DEPLOYMENT_CHECKLIST.md`, `docs/MIGRATION_REHEARSAL_REPORT.md` exist
(confirmed present by listing). Not re-read in full this pass.

## VA-51 / VA-52 Launch rehearsal / traffic rehearsal evidence
Not independently re-derived this pass. No load-test evidence checked.

## VA-53 / VA-54 / VA-55 Support / moderation / transport load readiness
Not independently re-derived this pass.

## VA-56 Commercial evidence
**N/A — confirmed absent.** No pricing/package claims exist anywhere in the repository (consistent
with VA-29/30/31/32/33 above).

## VA-57 Technical buyer walkthrough
Not independently re-driven this pass (would require actually attempting `npm install` / `db:reset`
/ `test` / `build` from documentation alone — not performed this pass given the shared-instance
scope decision recorded in the main report §3/§81).

## VA-58 Founder dependency
Not independently re-derived this pass. Carried forward from the fullday pass's opening due-diligence
coverage (`docs/BOT1_FULL_DAY_DUE_DILIGENCE_REVIEW.md`).

## VA-59 New operator takeover
Not independently re-derived this pass.

## VA-60 [FINAL] Real-beta go/no-go

**No-go**, using the exact decision rule given: **5 open, unaccepted High findings exist**
(H-1..H-5, §12 of `docs/BOT1_OVERNIGHT_FINALISATION_AUDIT.md`, all independently re-confirmed live
this pass), which alone is sufficient to block "ready" under the stated rule regardless of any other
row. Supporting detail:
- Critical: none open. ✔
- High: **5 open, unaccepted** — blocks. ✘
- Critical browser flows proven: **not proven this pass** — explicitly disclosed as a gap (no live
  browser available), not claimed. ✘ (gap, honestly disclosed)
- Privacy/consent: consent-versioning mechanism itself is genuinely adequate (VA-16/17, real
  evidence) — but three of the five open Highs are themselves privacy/trust-boundary failures
  (notification phishing, moderation self-resolution, deletion-request bypass). Mixed. ✘ overall
- Support/moderation operable: moderation has a live-confirmed self-conflict gap (H-3/VA-25). ✘
- Transport launch scope operable: live-confirmed customer-side status-forgery gap (H-4). ✘
- Release/recovery evidence: not independently re-derived this pass (carried forward, unverified).
- External providers fail safely: **N/A, trivially true** — no external provider is wired up at all
  yet (nothing to fail unsafely).
- Disabled features server-enforced: not independently re-derived this pass for maintenance
  mode/feature flags specifically (VA-48 above, not re-read in full).
- Legal uncertainties disclosed: **yes** — the consent-versioning migration's own comments are
  explicit that `/terms` and `/privacy` are draft/pending lawyer review; `docs/
  PRODUCTION_READINESS_REPORT.md` is cited by the lineage as the authoritative disclosure document.
- New users/operators can follow documentation alone: not independently re-driven this pass
  (VA-38/VA-57/VA-59 all unverified this pass).

**Overall: No-go**, primarily and sufficiently on the High-finding count alone; the browser-proof and
takeover-reproducibility gaps are secondary and would need to close even after the Highs are fixed.
