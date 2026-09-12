# Identity domain

Auth, session, profiles, roles, organisation membership/team management, and account privacy
(GDPR export/deletion). The dashboard route guards (`requireRole`) and `create_own_organisation`/
`approve_user_verification`/`reject_user_verification` RPC callers (in `create-breeder.tsx`, not in
this domain) both depend on what's here.

## What this owns

- `profiles` — public-safe reads only (`services/profile.ts`); "Only ever selects the columns
  anon/authenticated are actually granted... never email/phone/first_name/last_name"
  (`services/profile.ts:1-5`, backed by three separate lockdown migrations).
- `user_roles` — read via `CurrentUser.roles` (session), gated via `requireRole()`
  (`services/guards.ts:8-21`) — checks `role in allowedRoles && status === 'active'` only; does
  **not** read `organisations.verification_status` (relevant to the 2026-09-12 breeder
  self-registration rework — panel access and org verification are intentionally decoupled at this
  layer). `platform_role` gained `transport_company_owner` the same day
  (`20260912170832_transport_company_owner_role_enum.sql`, added first in its own migration since a
  new enum value can't be referenced in the same transaction that adds it) — a deliberately
  separate role from `driver`, which stays the individual freelance mobile-job-workspace role
  (`is_my_driver_id()`-gated); reusing it for company owners would either give every owner a mobile
  job workspace they don't want, or force those checks to special-case context.
- `organisations` (admin-side): `listAllOrganisationsForAdmin`, `setOrganisationVerificationStatus`,
  `setOrganisationFeatured`, `listFeaturedOrganisations` (`services/organisations.ts`). Comment:
  "'admins manage all organisations' RLS already existed... only the UI was ever missing" — i.e.
  this file is the UI-layer catch-up for a policy that predates it. **This is the existing
  mechanism for suspending/rejecting an already-approved organisation** (`setOrganisationVerificationStatus`
  accepts any `org_verification_status` value, including `suspended`) — relevant to any future
  moderator/admin panel work.
- `organisation_members`, `organisation_invitations` — full team lifecycle in `services/team.ts`,
  every mutation through a `SECURITY DEFINER` RPC (`invite_org_member`, `revoke_org_invitation`,
  `remove_org_member`, `set_org_member_status`, `change_org_member_role`, `leave_organisation`,
  `get_invitation_by_token`, `accept_org_invitation`, `decline_org_invitation`) — "never a raw table
  insert/update/delete from this file" (`services/team.ts:6-8`).
- Session/auth: `services/session.ts` (server-side `getCurrentUser`/sign-in-adjacent server fns),
  `services/actions.ts` (`signUp`/`signIn`/`signOut` — cookie-based, server fns), `hooks/use-auth.ts`
  (client-side reactive auth state).
- `services/privacy.ts` — GDPR Art. 20 data export. Deliberately excludes reporter identity on
  reports filed by others, internal moderation notes, and non-internal-only messages — "none of
  those tables/columns are queried here at all, not just filtered after the fact"
  (`services/privacy.ts:3-7`).

## File structure

- `index.ts` — re-exports `hooks/use-auth`, `services/actions`, `services/guards`,
  `services/organisations`, `services/privacy`, `services/profile`, `services/session`,
  `services/team`, `components/account-privacy-card`.
- `services/guards.ts` — `requireRole()`, used in every dashboard layout's `beforeLoad`. Explicitly
  a UX guard only: "the real enforcement is RLS on every table those pages query"
  (`services/guards.ts:6-7`).
- `services/organisations.ts` — admin org list/verification-status/featured-flag management
  (Stage I).
- `services/team.ts` — org team/volunteer management (Stage E,
  `20260101007700_organisation_team_management.sql`). Contains `orgMemberRoleLabels`
  (`services/team.ts:17-28`) — a **hardcoded-English label map**, same class of i18n gap already
  being fixed elsewhere this session for `applicationStatusLabels`/`reservationStatusLabel`.
- `services/profile.ts` — public profile page reads, column-locked to what's actually grantable.
- `services/actions.ts`, `services/session.ts` — sign up/in/out and current-user resolution.
- `services/privacy.ts` — GDPR export.
- `hooks/use-auth.ts` — client reactive auth (`{ userId, roles, isSignedIn, ... }`).
- `components/account-privacy-card.tsx` — the buyer-profile-page card wrapping export/delete.
- `components/organisations-panel.tsx` (added 2026-09-12) — `OrganisationsPanel`, extracted from
  `dashboard/admin/organisations.tsx` (one shared admin/moderator dashboard, not a separate
  moderator route tree — see below). Suspend/restore now goes through `setOrganisationSuspended`
  (`@/domains/trust`, a
  `moderator_set_organisation_suspended` RPC wrapper) instead of this domain's own
  `setOrganisationVerificationStatus` — the latter's plain RLS-gated update only ever worked for
  `is_admin()`, not a plain moderator. "Featured" stays admin-only (a marketing placement decision,
  not a trust one), hidden in the UI for non-admins rather than left to fail via RLS.

## Public API

`index.ts` exports the full surface flatly.

## Known gaps

- `orgMemberRoleLabels` (`services/team.ts:17-28`) is hardcoded English, not `t()`-based.
- `requireRole`'s explicit non-goal (real enforcement is RLS, this is UX-only) means any moderator
  panel gating (if built) needs its own RLS-backed check, not just a route guard here. **Resolved**
  2026-09-12 — `dashboard/admin.tsx`'s guard now accepts `["moderator", "admin"]` (moderator and
  admin share one dashboard, consolidated same-day after a separate `dashboard/moderator` tree was
  tried first — see `TODO.md`), each genuinely sensitive admin-only route additionally guards on
  `["admin"]` alone, and the underlying RLS/RPC layer was extended alongside it (see
  `src/domains/trust/AGENTS.md`).
- `setOrganisationVerificationStatus`/`setOrganisationFeatured` remain plain RLS-gated updates
  (admin/owner-only) — two parallel paths now exist for the same `verification_status =
  'suspended'` transition (this function, and the new moderator RPC in `trust`). Not consolidated;
  fine as long as both keep writing the same enum value.

## Related docs

- `docs/PRODUCT_VISION.md` — hierarchy pillars 2/3, cited in `services/profile.ts:1`.
- `docs/BREEDER_VERIFICATION_AND_TRUST.md` — the 2026-09-12 verification/onboarding rework that
  depends on `requireRole`'s role-only (not verification-status) check.

## Last significant change

2026-09-12 (this session, but not in this domain's own files): the breeder self-registration
rework relies on `requireRole`'s existing role-only check being exactly what it already is — no
code change was needed in `services/guards.ts` itself, confirmed by reading it during that work.
Same day, later: `create_own_organisation()` extended twice more — once to accept
`org_type = 'transport_company'` (granting `transport_company_owner`,
`20260912140000_transport_company_verification.sql`, which also moved
`approve_user_verification()`/`reject_user_verification()` from `is_admin()` to `is_moderator()` —
`is_admin()` staff keep working unaffected, since `is_moderator() := has_role(auth.uid(),
'moderator') OR is_admin()`), and once to accept a trailing optional `p_registration_number`
(`20260912160000_org_registration_number.sql` — foundations/shelters get a "registration number
(KRS)" label, transport companies an "operator license number" label, both mapping to the same
previously-unused `organisations.registration_number` column; the old 9-arg RPC overload was
explicitly `drop function`-ed in the same migration, since `create or replace` with a different
signature creates a second overload rather than replacing the first). A new dashboard panel for
this role (`dashboard/transport-company/`) was missing entirely and had to be built the same day to
unblock a broken production build — see `src/domains/breeders/AGENTS.md` and `TODO.md`.
