# Havenpaw — Domain Model

Principal entities and relationships as currently implemented in `supabase/migrations/`. This is a
living document — column-level detail lives in the migrations themselves; this file describes the
shape and *why*, not every field.

## Identity & organisations

- **`profiles`** — one row per `auth.users` row. `display_name`, `first_name`, `last_name`, `email`,
  `phone`, `avatar_url`, `preferred_language`, `preferred_currency`, `country`, `city`. Created
  automatically by a trigger on `auth.users` insert, reading sign-up metadata.
- **`user_roles`** — additive roles per profile (`customer`, `buyer`, `animal_owner`, `breeder`,
  `foundation_member`, `shelter_member`, `operations`, `driver`, `moderator`, `admin`), each with
  its own `status` (`pending`/`active`/`suspended`/`rejected`). A profile can hold several active
  roles at once — this is deliberately **not** a single "account type" column (see
  `DECISIONS.md`).
- **`organisations`** — one row per kennel/foundation/shelter/rescue/transport company/kennel club.
  `org_type`, `verification_status`, `is_public`, `owner_user_id` (the accountable owner — always
  set, independent of `organisation_members`), `public_location` (coarse, safe to show), and
  `private_address_id` (FK to `private_addresses`, never joined into public queries).
- **`organisation_members`** — links profiles to an organisation with a role within it (`owner`,
  `administrator`, `employee`, `breeder`, `volunteer`, `driver`, `viewer`). The owner also always
  has `organisations.owner_user_id` set directly, so ownership checks don't depend on this table
  existing yet at the moment an organisation is first created.
- **`user_verifications`** — the single generic verification/application pipeline. One row per
  `(user_id, verification_type)` where `verification_type` is `email`, `phone`, `identity`,
  `breeder`, `organisation`, `animal_ownership`, `driver` or `transport_employee`. `submitted_data`
  (jsonb) holds the applicant's payload (e.g. kennel name/description/breeds for a `breeder`
  verification); `approve_user_verification()` (SECURITY DEFINER) turns an approved `breeder`/
  `organisation` verification into an `organisations` row + owner `organisation_members` row +
  active `user_roles` row, atomically. `driver`/`transport_employee` approval activates the
  matching role directly. `notes`/`reviewed_by`/`reviewed_at` are admin-only.
- **`private_addresses`** — exact addresses for a user or an organisation, never publicly
  selectable. `latitude`/`longitude` exist for a future map phase but aren't populated or used yet.

## Animal directory & marketplace

- **`breeds`** — public reference directory (name, slug, size category).
- **`parent_dogs`** — a kennel's breeding dogs. Reusable across litters (a dog isn't duplicated per
  litter or per achievement — see `DECISIONS.md`).
- **`litters`** — belongs to a kennel + breed, references `mother_id`/`father_id` in
  `parent_dogs`. Puppies inherit litter/parentage data by reference, not by copy.
- **`animals`** — generalizes what would otherwise be three near-duplicate tables (breeder puppies,
  foundation adoption listings, private rehoming). `listing_category` distinguishes
  `breeder_puppy` / `adoption` / `private_rehoming` / `not_listed` (the last is just an animal
  profile attached to a transport request, never publicly listed). Exactly one of
  `organization_id` / `owner_profile_id` is set, enforced by a check constraint.
- **`animal_images`**, **`animal_ownership_history`**, **`saved_animals`** — supporting tables.
- **`buyer_applications`** — a buyer's application for a specific animal (purchase, adoption, or a
  rehoming inquiry — `application_type`). A partial unique index prevents more than one *active*
  application per (buyer, animal).
- **`reservations`** — created only from an *approved* `buyer_applications` row (enforced in the
  RLS `insert` policy itself, not just the UI).
- **`rehoming_reviews`** — gates whether a `private_rehoming` animal can be published; admin-only
  approval.

## Transport (the largest module)

- **`transport_requests`** — the center of the platform. Carries the full 7-step-form field set:
  request type/purpose, inline animal snapshot (plus optional `animal_id` link into `animals`),
  parties (`current_owner_profile_id`, `sender_org_id`, etc. — currently limited to Havenpaw users/
  orgs, not yet free-text external contacts, see `DECISIONS.md`), route (approximate + separate
  private-exact address columns), the compliance questionnaire, `compliance_review_result` (a
  routing label, never a legal decision), `requested_service_type`, the ~24-state operational
  `status` enum, and the 5 step-7 confirmation booleans.
- **`transport_status_history`** — append-only audit trail of every status change.
- **`transport_documents`** — per-category document tracking, private by default.
- **`quotations`** — draft quotations are ops-internal; only `sent`-or-later quotations are
  visible to the requester.
- **`compliance_reviews`**, **`handover_protocols`** — operational review/handover records.

## Routes & fleet

- **`routes`**, **`route_stops`**, **`route_assignments`** — a planned journey, its stops, and
  which transport requests are attached to it. Capacity is derived by counting assignments, not
  stored redundantly.
- **`vehicles`**, **`drivers`** — internal fleet/staff records, ops/admin-only (drivers can read
  their own record).
- **`transport_operator_authorisations`** — the company's own legal transport authorisation(s); a
  public "authorised" badge only ever reads `status = 'active'` here, never inferred from anything
  else.

## Trust, community, messaging, platform

- **`reports`**, **`moderation_cases`** — user-filed reports and the resulting moderation
  workflow; `decision_explanation` is never public.
- **`posts`, `comments`, `reactions`, `follows`, `saved_posts`** — community layer; the public post
  feed, likes and comments are real, working UI (`_public.community.tsx`), not schema-only. **
  `groups`, `group_members`** remain schema-only — no join/leave, no group-scoped posts, no UI at
  all yet (confirmed by grep — zero references outside migrations).
- **`conversations`, `conversation_participants`, `messages`** — messaging, including one
  conversation per transport request; `is_internal` messages are never customer-visible.
- **`notifications`**, **`audit_logs`** — platform plumbing.

## Fundraising (planned — no schema yet)

Verified-organisation fundraising (hierarchy pillar 7 in `docs/PRODUCT_VISION.md`) is policy-defined
in `docs/FUNDRAISING_POLICY.md` but **has no tables, RLS, or UI yet** — that's deliberate (see
`docs/IMPLEMENTATION_PLAN.md` phase 13). When it's built, expect roughly: a `fundraising_campaigns`
table (organisation, animal/adoption application, transport request, quotation, target amount,
state) and a `fundraising_contributions` table (amount, optional public message, anonymity flag,
payment-provider reference) — but don't treat this paragraph as a spec; the real column-level design
happens when that phase starts, against whatever payment provider is chosen by then. This entry
exists only so a future schema change doesn't have to rediscover that fundraising was deliberately
deferred rather than forgotten.

## Cross-cutting patterns worth knowing before extending this schema

- **RLS is universal.** Every table enables RLS in the same migration that creates it. Public
  (`anon`) access is always an explicit, narrow `select` policy — never a default-open table.
- **Helper functions, not repeated subqueries.** `public.is_admin()`, `public.is_moderator()`,
  `public.is_ops_staff()`, `public.owns_org()`, `public.is_org_member()`, `public.has_role()` are
  `SECURITY DEFINER` and used throughout policies instead of inlining the same `exists(...)` check
  everywhere.
- **Mixed public/private columns on one table are handled with a view, not a column grant.**
  `public_transport_requests` is a `SECURITY DEFINER`-style view (deliberately *not*
  `security_invoker`) that hand-picks safe columns — see the comment in
  `20260101002300_public_views.sql` for why that's the correct pattern here.
- **Forward references between migrations are fine for function bodies**, not for `CREATE POLICY`
  (which is parsed immediately). Where a policy genuinely needs a not-yet-existing table, the
  policy is added in a *later* migration once that table exists (see the `rehoming_reviews` →
  `animals` policy, or the `transport_requests` → `routes`/`vehicles`/`drivers` FK constraints).
