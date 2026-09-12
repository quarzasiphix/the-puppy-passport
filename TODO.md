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

- [ ] Confirm the exact repro for the "breeder locked out during review" complaint that started the
      2026-09-12 verification rework — the code path couldn't be found as described; either it was
      already fixed by this pass or there's a specific dead-end screen still worth checking.
