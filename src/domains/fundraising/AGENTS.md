# Fundraising domain

Verified-organisation fundraising campaigns (hierarchy pillar 7, `docs/PRODUCT_VISION.md`), full
schema/RLS/UI built and tested, **kept disabled in production behind a feature flag** until a real
payment provider, refund rules and legal texts are approved (`docs/FUNDRAISING_POLICY.md`).

## What this owns

- `fundraising_campaigns` — `listPublicCampaigns`, `getPublicCampaign`, `listCampaignsForOrg`,
  `listCampaignsForReview`, `createCampaign`, `submitCampaignForReview`, `approveCampaign`,
  `activateCampaign`, `suspendCampaign` (`services/fundraising.ts`, 346 lines). Every campaign
  requires a real `animal`, `buyer_application`, `transport_request` and *accepted* `quotation` —
  "a campaign is never standalone" (per `docs/DOMAIN_MODEL.md`); this domain's `createCampaign`
  and `listEligibleQuotationsForOrg` are the client side of that constraint.
- `fundraising_contributions`, `public_fundraising_contributions`,
  `public_fundraising_totals` — `listPublicContributions`, `contributeSimulated`.
  `contributeSimulated` is the **only** contribution path — real payment processing doesn't exist,
  `is_simulated` defaults `true` and is enforced server-side (per `docs/DOMAIN_MODEL.md`).
- `FUNDRAISING_ENABLED` flag (`services/fundraising-flag.ts`) — reads
  `VITE_FUNDRAISING_ENABLED`, "Never set this in a production build" (`:8`). Every entry point is
  expected to check this first and show an honest "not yet available" state when off — see
  `components/fundraising-disabled-notice.tsx`.

## File structure

- `index.ts` — re-exports `services/fundraising-flag`, `services/fundraising`,
  `components/fundraising-disabled-notice`.
- `services/fundraising-flag.ts` (9 lines) — the flag, described above.
- `services/fundraising.ts` (346 lines) — campaign + contribution CRUD, described above. Also
  `campaignStatusLabels` — a hardcoded `Record<FundraisingCampaignRow["status"], string>`, despite
  its own comment right above it saying "Plain-language labels — never show a raw status enum value
  to an organisation or a supporter (see CLAUDE.md's UX principle)" — the principle is honored
  (labels exist, aren't raw enum values) but the *implementation* isn't i18n'd, same class of gap as
  `applicationStatusLabels`/`reservationStatusLabel` before their 2026-09-12 fix.
- `components/fundraising-disabled-notice.tsx` — the shared "not available yet" UI shown wherever
  `FUNDRAISING_ENABLED` is false.

## Public API

`index.ts` exports the full surface flatly.

## Known gaps

- `campaignStatusLabels` is hardcoded English — listed in the repo-root `TODO.md` alongside
  `welfareCaseStatusLabels`/`orgMemberRoleLabels` as not yet converted to the `t()`-based pattern.
- **`suspendCampaign` already exists** — relevant prior art if a moderator/admin panel needs a
  "suspend this fundraising campaign" action; don't build a new one without checking this first.
- The entire domain is feature-flagged off in production — don't assume any UI here is reachable by
  a real user today; verify `FUNDRAISING_ENABLED` at the call site before treating a bug report
  here as live-traffic-affecting.

## Related docs

- `docs/FUNDRAISING_POLICY.md` — eligibility, campaign requirements, financial rules.
- `docs/PRODUCT_VISION.md` — hierarchy pillar 7.
- `docs/DOMAIN_MODEL.md` — the campaign-validity invariant and simulated-contribution design.

## Last significant change

Not determined from in-domain evidence in this pass; per `docs/DOMAIN_MODEL.md` the schema itself
was "built 2026-07-22". File created 2026-09-12 as part of the project-wide `AGENTS.md` rollout.
