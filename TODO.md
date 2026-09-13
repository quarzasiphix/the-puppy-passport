# Anemalo — open work

Cross-cutting "what's still open" list, project-wide. Not a duplicate of `docs/DECISIONS.md`
(accepted decisions) or a domain's own `src/domains/*/AGENTS.md` (domain-local detail) — this is
specifically the running list of known gaps, drafted-but-unapplied work, and undecided questions.
Add to it when you find or create a real gap; remove/check off an item when it's actually done —
see the "Module-level docs and the TODO list" section in `CLAUDE.md` for the maintenance rule.

## Verification & trust

- [ ] **Kennel-club registry migration not applied.** `docs/KINOLOGICAL_ORGANISATION_REGISTRY.md` +
      `supabase/migrations/20260910100000_kinological_organisations.sql` are fully designed
      (`kinological_organisations`, `..._relationships`, `breeder_organisation_memberships`,
      suggestion table) but the migration is marked `NOT APPLIED` and has never been run.
- [ ] **WNI (weterynaryjny numer inspektoratu) not modeled anywhere.** Proposed in
      `docs/BREEDER_VERIFICATION_AND_TRUST.md` as a 4th `organisation_trust_claims` type
      (`veterinary_registration`) — no migration written yet, no UI.
- [ ] **No document-upload UI in breeder onboarding.** `create-breeder.tsx` only collects text
      fields (`associationName`/`membershipNumber`); `user_verifications.evidence_url` exists in
      the schema but nothing ever writes to it. Needed for WNI + kennel-club evidence.
- [ ] **Admin panel: separate app vs. same-app-behind-a-second-gate — undecided.** Tradeoff written
      up in `docs/BREEDER_VERIFICATION_AND_TRUST.md`; product owner hasn't picked one.
- [x] **Moderator-role panel** — done 2026-09-12. `dashboard/moderator` route tree
      (`requireRole(["moderator", "admin"])`), reusing `ModerationPanel`/`ReportsPanel`
      (`src/domains/trust/components/`, also now shared by `dashboard/admin`). Real enforcement
      actions added (hide/unhide post, unpublish/republish listing, suspend/reinstate org) via
      new `SECURITY DEFINER` RPCs — see `src/domains/trust/AGENTS.md` "Known gaps" for the full
      writeup. "Verify a new breeder" was already covered by the existing breeder-verification
      flow, just not moderator-reachable before this pass (now is, via the same role guard).
      **Not done**: per-user (not per-org) suspension/timeout — no such mechanism exists in the
      schema at all yet, only per-organisation. `src/domains/identity/services/organisations.ts`'s
      pre-existing `setOrganisationVerificationStatus` (plain RLS-gated update, admin/owner-only)
      and the new moderator RPC are two parallel paths to the same enum value — fine for now,
      worth consolidating if a third caller ever needs it.
- [x] **Moderator access to verification/review surfaces** — done 2026-09-12 (same pass as above).
      `approve_user_verification()`/`reject_user_verification()`/`approve_rehoming_review()` now
      gate on `is_moderator()` instead of `is_admin()`; new `reject_rehoming_review()` RPC (reject
      used to be a plain client UPDATE, unreachable for a moderator under the old
      admin-only RLS). Added moderator SELECT policies on `user_verifications`/`organisations`/
      `rehoming_reviews`/`achievements` (RLS silently returns empty lists rather than erroring, so
      without these a moderator would just see nothing). Extracted `OrganisationsPanel`
      (`src/domains/identity/components/`), `RehomingReviewsPanel`
      (`src/domains/marketplace/components/`) and `AchievementVerificationPanel`
      (`src/domains/animals/components/`) so admin and moderator routes share one implementation.
      Moderator nav now has: Reports, Moderation, Breeder verification, Foundation verification,
      Organisations, Listings, Achievement verification.
- [x] **Admin/moderator dashboard consolidation** — done 2026-09-12, same pass. Product decision:
      one shared dashboard (`/dashboard/admin`, `requireRole(["moderator", "admin"])`) rather than
      a parallel `/dashboard/moderator` tree — deliberately not splitting further "for now" (see
      `docs/BREEDER_VERIFICATION_AND_TRUST.md`'s admin-app-separation discussion; revisit if/when
      that separate app actually gets built). `adminNavFor(isAdmin)` in `navigation.ts` shows the
      moderator a subset; the four genuinely sensitive pages (`users`, `fundraising`, `audit-logs`,
      `settings`) each carry their own `requireRole(["admin"])` so hiding them from the nav isn't
      the only thing stopping a moderator who types the URL directly. The `is_moderator()`-gated
      RLS/RPC layer from the item above is unaffected by this — it's a pure routing/UI change.
- [ ] **`dog_registry_identifiers` deferred.** Per-dog multi-registry identifiers (FCI + national +
      breed club numbers on one dog) — flagged in the kennel-registry doc as worth adding only once
      the product actually surfaces it. Not started.
- [x] **Transport-company dashboard panel — built 2026-09-12 (this session).** `org_type =
      'transport_company'` had full nav config (`transportCompanyNav`) and i18n copy already
      written (overview KPIs, vehicles, drivers, jobs, team, profile, settings) but **zero route
      files existed** — `create-breeder.tsx`'s `dashboardPathForOrgType()` pointed at
      `/dashboard/transport-company`, which didn't resolve, breaking `tsc --noEmit`/the production
      build outright. Built all 8 route files (`dashboard/transport-company.tsx` layout +
      `index`/`vehicles`/`drivers`/`jobs`/`team`/`profile`/`settings`), reusing existing
      domain functions verbatim (`getMyTransportCompany(Profile)` in
      `src/domains/animals/services/transport-company.ts`, already written and re-exported via
      `breeders`; `listVehicles`/`createVehicle`/`listDrivers`/`createDriver` in
      `src/domains/transport/services/fleet.ts`, RLS-scoped by `organization_id` so no client-side
      org filter was needed; the generic `inviteOrgMember`/`listOrgMembers`/etc. team RPCs from
      `identity`, cloned from `foundation/team.tsx`). Added one new function,
      `listMyFleetJobs()` (`fleet.ts`), for the read-only Jobs tab. `npx tsc --noEmit` and
      `npm run build` both clean afterward.

## Server-side / notification i18n

- [ ] **Background notification text is English-only.** `NOTIFICATION_STATUS_LABELS_EN` in
      `src/domains/marketplace/services/applications.ts` — no React `t()` context server-side, no
      lookup of the recipient's `profiles.preferred_language`. Needs a locale-aware, non-hook
      translate helper before notifications can be genuinely bilingual.
- [ ] **A few shared status-label helpers still hardcode English**: `campaignStatusLabels`
      (fundraising), `welfareCaseStatusLabels`, `orgMemberRoleLabels` — same class of gap as
      `applicationStatusLabels`/`reservationStatusLabel` (already fixed 2026-09-12), just not yet
      converted to `t()`-based functions.

## Integrations

- [ ] **POK pedigree-registry sync** (`docs/POK_INTEGRATION.md`) — designed, one-directional
      (POK → Anemalo pull), edge-function-based. Blocked on a legal data-sharing agreement, not a
      technical gap.

## Product decisions still open

- [ ] **Fleet/route-optimization layer (Google Maps API), raised 2026-09-13, not built.** See
      `src/domains/transport/docs/TRANSPORT_MARKETPLACE_VISION.md` — the product owner's own "eventually": once trip
      stops carry real geocoded addresses (not just pasted Maps links), a routing/distance-matrix
      API could suggest the most efficient stop order for a multi-animal trip. No geocoding exists
      anywhere in the transport domain today; this is real, separate work, sequenced after the
      public-trips/join-request flow below has real usage.
- [x] **Public trip visibility, transport-company directory, join-request flow — built 2026-09-13.**
      `public_trips` view (opt-in per trip, geography/date/status/stop-count only, mirrors
      `public_routes`' safety boundary), `/transport-companies` directory (mirrors `/breeders`/
      `/foundations`), `trip_join_requests` (lightweight pickup/dropoff/contact ask on a published
      trip, accept-to-real-stop in one action). `/planned-routes` redesigned into "Anemalo routes"/
      "Company trips" tabs. Deliberately no scored matching engine and no geocoding — see
      `src/domains/transport/docs/TRANSPORT_MARKETPLACE_VISION.md` for the full reasoning and what's next.
- [ ] **Generalize the `@handle` public profile beyond breeders, raised 2026-09-13, not designed.**
      `/@{$handle}` (src/routes/_public/@{$handle}.tsx) is breeder-only today — built around the
      `Breeder` type and kennel-specific tabs (Dogs, Litters, Alumni, Pedigrees). Foundations and
      transport companies each have an internal dashboard profile editor
      (`dashboard/foundation/profile.tsx`, `dashboard/transport-company/profile.tsx`) but no public
      page at all — their branding/logo/site config (`organisation_site_configurations`) has
      nowhere to actually render publicly. Generalizing means: an org-type-aware version of that
      route (or a shared shell with per-type tab sets), not a copy-paste per type. Real work, not
      started — needs its own design pass before touching the route.
- [ ] **"Account hopping" is deliberately not restricted yet (product owner, 2026-09-13)** — signing
      into a second account in the same browser/session isn't blocked, on purpose, to allow private
      testing. Revisit once there's a local dev environment to test the restriction against before
      shipping it — no design or code exists for this yet, just the decision not to block it now.
- [ ] Confirm the exact repro for the "breeder locked out during review" complaint that started the
      2026-09-12 verification rework — the code path couldn't be found as described; either it was
      already fixed by this pass or there's a specific dead-end screen still worth checking.
- [ ] **Sealed-bid breeding-stock idea, raised 2026-09-13, not designed or built.** For rare/older
      pedigree adult dogs on the (also not-yet-built) breeder-to-breeder market
      (`docs/PRODUCT_VISION.md` pillar 1): sealed bids with a reserve price and a closing date,
      highest offer at close wins — not a live/real-time auction. Sequence after the
      breeder-to-breeder market itself exists and after the deposit/checkout path has had time to
      prove out (`reservation_checkout_attempts`, 2026-09-13) rather than layering a new
      transaction type onto the just-hardened puppy-reservation flow.
