# Data Classification

Stage CJC of the autonomous backend-hardening session (see `docs/AUTONOMOUS_BACKEND_PROGRESS.md`).
`docs/PRIVACY_DATA_LIFECYCLE.md` (Stage O) already catalogues every category of *personal* data in
detail (GDPR-focused: what it is, where it lives, who can read it, what data-subject-rights
mechanisms exist) — not repeated here. This document is broader and shallower: a simple four-tier
classification covering *everything* sensitivity-relevant in this schema, personal and non-personal
alike, so a future change can quickly answer "what tier is this data in, and does my change respect
that" without re-deriving it from the RLS policies each time.

## The four tiers

| Tier | Meaning | Enforcement expectation |
|---|---|---|
| **Public** | Safe for `anon`, by design — the whole point is that anyone can see it | A real, explicit `to anon using (...)` RLS policy or public view column list; never "public by omission" |
| **Internal** | Visible to any authenticated user, but not to the outside world | RLS scoped `to authenticated`, no `anon` policy |
| **Restricted** | Visible only to the specific parties involved (the owner, named parties, the assigned staff/driver) plus ops/admin | RLS scoped to a specific row-relationship check (`= auth.uid()`, `is_named_transport_party()`, `is_assigned_driver_for_request()`, etc.) |
| **Confidential (staff-only)** | Never shown to the data subject themselves, only to moderators/ops/admin — internal reasoning, not a fact about the world the subject already knows | RLS/column-lock explicitly excludes the subject even though they can see the *row* (`is_internal`, `internal_notes`, `decision_explanation`) |

## Classification by category

| Category | Tier | Example columns/tables | Note |
|---|---|---|---|
| Marketplace listings (published) | Public | `animals`/`litters`/`organisations` where `is_published`/`is_public` and approved | The default state of a published listing |
| Community posts/comments (public visibility) | Public | `posts`/`comments` where `visibility = 'public'` | Author controls visibility per-post |
| Aggregate/anonymised stats | Public | `public_transport_rating`, `public_fundraising_totals` | Sums/averages only, never a per-row identity |
| Display name, avatar, city/country | Public (limited columns) | `profiles` anon-readable column subset | Never email/phone — see Restricted below |
| Community-visible transport requests | Public (limited columns) | `public_transport_requests` view | Never exact address — see Restricted below |
| Own dashboard/profile data | Internal | Most of `transport_requests`, `buyer_applications`, `reservations` as seen by their own owner | Visible to the owner, not to arbitrary other authenticated users |
| Marketplace search/browse metadata | Internal→Public boundary | See `docs/DATA_CLASSIFICATION.md`'s "Public" row above — most browse data is intentionally public once published | — |
| Contact details | **Restricted** | `profiles.email`/`profiles.phone` | Column-grant-locked — not even a plain RLS row check, `authenticated`'s column grant excludes them entirely (`docs/PRIVACY_DATA_LIFECYCLE.md`) |
| Exact addresses | **Restricted** | `pickup_address_exact`/`destination_address_exact`, `private_addresses`, `welfare_cases.location_address_exact` | Requester/named parties/ops/admin only; never in any public view (`docs/DATABASE_INVARIANTS.md`'s visibility invariants) |
| Identity/compliance documents | **Restricted** | `transport_documents`/`welfare_case_documents`, private Storage buckets | Signed-URL-only, never a public link |
| Adoption questionnaire answers | **Restricted** | `buyer_applications` (housing, income-adjacent fields) | Applicant + reviewing org/ops only |
| Risk signals | **Confidential (staff-only)** | `risk_signals` | The flagged account never sees their own signal — advisory data *about* them, not *for* them (Stage BN) |
| Internal moderation/support notes | **Confidential (staff-only)** | `messages.is_internal`, `support_case_messages.is_internal`, `moderation_cases.decision_explanation`, `moderation_appeals.internal_notes` | Explicitly excluded from the subject's own view even though they can see the parent row |
| Audit trail | **Confidential (staff-only)** | `audit_logs` | Admin-readable only; not a data-subject-facing record even though it may reference the subject |
| Rate-limit/abuse telemetry | **Confidential (staff-only)** | `rate_limit_events` | Admin-readable only |
| Business/pricing configuration | **Internal (write: staff-only)** | `pricing_rules`, `markets` | Publicly *readable* where a public policy exists (active pricing rules), but only staff can write |
| Report reporter identity | **Confidential (staff-only)** | `reports.reporter_profile_id` vs. the reported party | The reported party never sees who reported them — a deliberate anti-retaliation design, not an oversight |

## What this document deliberately does not attempt

- Re-deriving `docs/PRIVACY_DATA_LIFECYCLE.md`'s detailed GDPR data-subject-rights analysis — that
  document is the authoritative source for "what personal data exists and what rights mechanisms
  cover it."
- A column-by-column classification of all ~500+ columns in the schema — the categories above cover
  every *kind* of sensitivity this schema actually has; a specific new column should be classified
  by matching it to the closest existing category, not by adding a new row for every table.
- Legal sign-off on classification adequacy — like `docs/PRIVACY_DATA_LIFECYCLE.md`, this is an
  engineering reference, not legal advice.
