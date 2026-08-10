# Anemalo — Fundraising Policy

Written 2026-07-22 as a product/policy decision, **implemented the same day** (see
`docs/IMPLEMENTATION_PLAN.md` phase 13 for the full build detail, `docs/DOMAIN_MODEL.md` for the
schema, `tests/db/fundraising.test.ts` for the security test coverage). This document remains the
authoritative statement of **what fundraising on Anemalo is and is not allowed to do** — the
implementation must conform to this policy, not the other way around. There is still no real
payment provider integration or wallet, and the whole feature stays disabled by default behind
`VITE_FUNDRAISING_ENABLED` (`src/lib/fundraising-flag.ts`) until one is approved along with refund
rules and legal texts.

## Why fundraising exists on Anemalo at all

Transport is a real cost, and a distant adoption (an approved organisation or adopter who can't
fully cover an eligible Anemalo transport) is exactly the situation where community support has
genuine value — matching hierarchy pillar 7 in `docs/PRODUCT_VISION.md`. Fundraising is a supporting
feature for the animal-welfare mission, not a payments product in its own right and not a way to
crowdfund the purchase of an animal.

## Eligibility — who may create a fundraiser

Only an **approved organisation with a completed verification** may create a fundraiser:

- verified foundations;
- registered associations;
- shelters;
- rescue organisations;
- other approved non-profit animal-welfare organisations.

**Ordinary private users, buyers and adopters cannot create personal fundraising campaigns.**
Selecting "foundation" during registration does not, by itself, grant fundraiser permission —
that requires an actually-approved `user_verifications` row and an active `organisations` row (see
`DOMAIN_MODEL.md`), the same gate that already applies to publishing adoption listings.

## What fundraising may never fund

- **Purchasing an animal.** No fundraiser may exist to help pay a breeder's price or an adoption
  fee — only transport and related animal-welfare costs (see "Future campaign types" below).
- A private individual's own campaign of any kind.

## The primary campaign type: "Help this animal reach its new home"

A transport fundraiser must be connected with all of the following — never created standalone:

- a verified organisation;
- a real animal (or adoption listing);
- an approved or active adoption process (a real `buyer_applications` relationship, not just
  interest expressed);
- a real Anemalo transport request;
- an approved transport quotation;
- a fixed funding target (the quotation's total, or a defined portion of it — never an open-ended
  ask).

**A campaign page shows**: the animal, the verified organisation, the approximate transport route
(never exact addresses), why transport is needed, a transport quotation summary, amount collected,
amount remaining, updates from the organisation, and what happens when the target is reached. It
must never expose exact addresses, private adopter details, veterinary documents, or other internal
transport data — the same privacy boundary already enforced elsewhere for transport requests (see
`DECISIONS.md`).

## Financial rules

- **No Anemalo wallet.** Money is never held by Anemalo as a balance a user can spend elsewhere.
- The payment flow is designed around a **replaceable, licensed external payment provider** — not
  built into this policy, decided at implementation time.
- Money collected for a transport campaign is **applied directly to the connected Anemalo
  transport balance** — never freely withdrawable by the adopter or any other private person.
- **Not permitted, ever**:
  - private cash withdrawal;
  - changing a campaign's purpose after its first payment;
  - raising more than the approved target without a defined excess-funds policy (see "Auditable
    situations" below);
  - creating a duplicate campaign for the same quotation;
  - raising money to purchase an animal;
  - a campaign from an unverified organisation.
- Anemalo must **never claim every payment is a tax-deductible charitable donation** — that
  depends on the receiving organisation's own legal/tax status in its jurisdiction, which Anemalo
  cannot universally guarantee.

## Campaign states

`draft` → `organisation_review` → `approved` → `active` → (`target_reached` | `partially_funded` |
`expired`) → `completed`, with `transport_cancelled`, `suspended`, and `refund_review` available as
exception states at any point after `approved`. Exact state-machine transitions are an
implementation detail for the module-build phase, not fixed here — but no state may be skipped in a
way that lets money move before an organisation is verified and a real transport request/quotation
exists.

## Auditable situations the eventual implementation must handle

- Partial funding (target not reached by the deadline).
- The adopter or organisation paying the remainder directly (outside the fundraiser).
- Transport cancellation after funds are collected.
- A quotation change after a campaign is already active (target must not silently drift).
- Excess funds (raised more than the approved target, once an excess-funds policy is defined).
- Refunds.
- A disputed campaign (moderation-relevant — reuse `reports`/`moderation_cases`, see
  `DOMAIN_MODEL.md`).
- A suspended organisation (any of its active campaigns must be handled explicitly, not left
  silently running).

## Supporter experience (policy-level expectations, not a UI spec)

Supporting a campaign should be simple on mobile. A future supporter should be able to: choose an
amount, remain anonymous publicly, leave a public message, follow updates, and share the campaign.

## Future campaign types (kept on the list, not committed to the near-term build)

Beyond "help this animal reach its new home," verified organisations may eventually run campaigns
for: rescue transport, veterinary treatment, animal care, and emergency rescue routes.
**Transport-specific support must stay clearly separate from general organisation support** — a
supporter should always know whether their contribution is tied to one specific animal's transport
or to an organisation's broader work.

## Implementation status

**Built 2026-07-22** — schema, RLS, org/admin/public UI and a development-only simulated-payment
flow all exist and are tested (`docs/IMPLEMENTATION_PLAN.md` phase 13,
`tests/db/fundraising.test.ts`). Still gated behind `VITE_FUNDRAISING_ENABLED`, unset (disabled) by
default, until a real payment provider, refund rules, and legal texts (see
`docs/PRODUCTION_READINESS_REPORT.md`'s "Requires legal review" section) are explicitly approved.
Not built: real payment provider integration, and dedicated UI for the excess-funds/refund/dispute
states beyond the schema already supporting them.
