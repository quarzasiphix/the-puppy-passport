# Privacy & Data Lifecycle Audit

Stage O of the autonomous backend-hardening session (see
`docs/AUTONOMOUS_BACKEND_PROGRESS.md`). Backend-only audit of what personal data Anemalo stores,
how it's protected, what data-subject-rights mechanisms already exist end-to-end vs. are only
partially built, and what's deliberately deferred to a later stage. This is a snapshot of the real
schema/RLS/Storage state as verified against a running local Supabase instance
(`npx supabase db dump --local --schema public`, cross-checked against `supabase/migrations/*.sql`
and the query layer in `src/lib/queries/*.ts`) — not a claim about legal sufficiency. Nothing here
constitutes legal advice; a real GDPR compliance sign-off needs a lawyer, not just this document.

## What personal data Anemalo stores

| Category | Where | Who can read it (besides the owner/admin) |
|---|---|---|
| Account identity (name, avatar, city/country, locale) | `profiles` | Any authenticated user (needed for normal marketplace/social features — display names on listings, reviews, posts) |
| Contact details (email, phone) | `profiles.email`/`profiles.phone` | Nobody except the owner and `service_role`. Locked down at the column-grant level (`20260101003200_profiles_contact_lockdown.sql`) after a real bulk-harvesting gap was found and fixed — `authenticated`'s column grant excludes `email`/`phone` entirely, and `get_my_profile()` is the only path back to your own contact details. |
| Exact pickup/delivery addresses | `transport_requests.pickup_address_exact`/`destination_address_exact` | Requester, named parties, ops/admin only (RLS-restricted; public map views never expose this — see `docs/PRODUCT_VISION.md` rule 6) |
| Private residential/organisation addresses | `private_addresses` | Owner (user or org), admins only |
| External (non-Anemalo) contact for transport parties | `transport_parties.external_name`/`external_phone`/`external_email` | Request owner and ops/admin only |
| Welfare-case contact/location | `welfare_cases.contact_phone`/`location_address_exact` | Members of the reporting organisation and ops/admin only — entire row is org+ops scoped, no public policy exists at all |
| Adoption questionnaire answers | `buyer_applications` (housing, children, income-adjacent fields like `working_schedule`, landlord permission, vet plan) | The applicant and the reviewing organisation's members/ops only |
| Identity documents (passport/health-certificate scans, welfare-case evidence) | Supabase Storage, `transport-documents` and `welfare-case-documents` buckets, metadata rows in `transport_documents`/`welfare_case_documents` | Both buckets are **private** (`public = false`); access is via short-lived signed URLs generated per request, never a public/static link (verified in `tests/db/transport-domain.test.ts`, "real document upload flow: private Storage object + signed URL, not a public link") |
| Verification submissions (breeder/org applications) | `user_verifications.submitted_data`/`evidence_url` | Submitter and admins only |
| Animal identifying data (microchip numbers) | `animals`/`parent_dogs`/`transport_request_animals.microchip_number` | Same visibility as the parent row (published-listing fields are public by design; transport-request microchip data follows the request's own RLS) |
| Consent metadata (adoption-specific) | `buyer_applications.consent_version`/`consent_given_at` | Applicant and reviewing org/ops |

## Data-subject rights: what's real today vs. deferred

- **Access / portability (GDPR Art. 15/20)** — real and working. `exportMyData()`
  (`src/lib/queries/privacy.ts`) pulls the caller's own profile, roles, transport requests,
  reservations, applications, saved animals, waitlist entries and community posts. Every query in
  it filters by the caller's own id *and* is additionally protected by RLS regardless of what the
  function requests, so it can't be miscalled into leaking someone else's data even by a coding
  mistake.
- **Rectification (Art. 16)** — real, via the ordinary profile-edit / application-edit flows
  already in the app; not a separate mechanism, so not itself audited here.
- **Erasure (Art. 17) — request tracking is real, execution is not.** `requestAccountDeletion()`
  inserts into `account_deletion_requests` (self-service, RLS-scoped to the requester). Admins can
  list and mark requests `processed`/`declined` via `markDeletionRequestProcessed()`. **What
  `markDeletionRequestProcessed()` does not do: actually delete or anonymise any data.** It only
  flips the request row's own status/timestamp — no trigger, RPC, or job currently hard-deletes or
  anonymises the requester's `profiles` row or related content. This matches
  `docs/AUTONOMOUS_BACKEND_PROGRESS.md`'s existing "deletion/anonymisation execution" item (Stage
  AI in the supplemental queue), and is deliberately not implemented in this stage — flagged here
  so it isn't mistaken for done. Real execution will also need to account for the FK design found
  during Stage L: audit-trail columns referencing `profiles(id)` (`reviewed_by`,
  `assigned_moderator_id`, `uploaded_by`, etc.) have no `ON DELETE` action by design, so a raw
  `DELETE FROM profiles` would fail outright wherever the user left an audit trail — execution will
  need to be an anonymisation (null out contact fields, keep a tombstoned row) rather than a hard
  delete for any account with audit-trail references, and a real hard delete only for accounts with
  none.
- **Restriction of processing / objection (Art. 18/21)** — not implemented; no mechanism exists to
  mark an account "restricted" short of the existing suspend/ban moderation actions, which are a
  different concept (enforcement, not a privacy right). Not in this stage's scope; flagged as a gap.
- **Consent versioning** — only exists for the one flow that already needed it (adoption
  applications: `consent_version`/`consent_given_at`). There is no platform-wide terms-of-service /
  privacy-policy acceptance record (version + timestamp) for signup, and no marketing-communication
  opt-in tracking beyond the notification-category preferences added in Stage H
  (`notification_preferences`, which govern in-app/email notification categories, not legal
  consent). "Consent versioning" is explicitly its own later stage in the third supplemental queue
  — not built here to avoid a half-built, inconsistent mechanism landing twice.

## Retention

- **Indefinite by design, and that's correct**: `audit_logs` (compliance/accountability trail —
  the whole point is that it outlives the action it records), `transport_status_history` (the
  operational record of a completed transport).
- **Indefinite, currently harmless, worth revisiting under real load**: `notifications` and
  `rate_limit_events` grow forever with no purge job. Neither currently causes a correctness
  problem (`rate_limit_events`' own migration already notes old rows are "pure noise once their own
  window has passed... cheap enough to prune opportunistically" — a future stage, not a bug), and
  neither holds PII beyond a `profile_id` foreign key already governed by that profile's own
  lifecycle. Not urgent, but worth a scheduled-cleanup job once Stage BA (background jobs) exists.
- **Audit log content was checked for accidental PII leakage** — every `audit_logs.before`/`after`
  insert in the schema was spot-checked (`organisation_invitations`, `organisation_members`,
  `welfare_cases`, `transport_request_amendments`, moderation) and all of them log narrow,
  specific field diffs (e.g. `jsonb_build_object('status', old.status)`), never a full-row dump —
  so the admin-only audit trail doesn't become a second, less-protected copy of contact details or
  addresses. `audit_logs` itself is admin-only read (`"admins view audit logs"` policy), never
  exposed to ops/moderators/organisations.

## Third-party data sharing

None. `package.json` has no analytics, error-tracking, or marketing SDK (grepped for
analytics/Sentry/PostHog/Mixpanel/Segment/gtag — none present). All data stays inside the Supabase
Postgres instance and Storage buckets described above; no outbound sharing exists to audit.

## What this audit did not find wrong

Everything under "What personal data Anemalo stores" above was checked against its actual RLS
policies and, where relevant, Storage bucket configuration (not just read from a comment) — no new
column-level or bucket-level leak was found. This is a narrower claim than "the whole schema is
GDPR-compliant": it means the specific personal-data columns/tables enumerated here are access-
controlled the way their surrounding code comments already claimed, re-verified rather than
assumed.

## Known gaps (not fixed in this stage — see reasoning above for why)

1. Account deletion is request-tracking only; no actual deletion/anonymisation execution exists
   yet (deferred: Stage AI).
2. No platform-wide consent/terms-of-service version tracking (deferred: its own later stage,
   "consent versioning").
3. No restriction-of-processing mechanism distinct from moderation suspension/ban.
4. `notifications`/`rate_limit_events` have no scheduled purge job (deferred: Stage BA, background
   jobs).
