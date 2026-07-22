# Havenpaw — Product Vision

**Scope corrected 2026-07-22 — this supersedes any earlier framing that described animal transport
as Havenpaw's primary identity.** Transport is a major advantage of the platform, not what Havenpaw
fundamentally is. See `docs/DECISIONS.md` for the full record of this correction and why it was
made.

## What Havenpaw is

Havenpaw is a **dedicated European animal ecosystem**: a trustworthy home for finding, adopting,
and welcoming an animal, built around verified breeders and organisations, a real community, and —
once a purchase or adoption is agreed — safe, professional transport.

It is **not**:
- a generic OLX/classifieds clone;
- a pet shop;
- a childish dog website;
- an unmoderated Facebook group;
- an open marketplace where random transporters can accept jobs;
- **a general marketplace.** Havenpaw must never expand into unrelated categories — cars,
  electronics, furniture, tools, or any other classifieds vertical. Everything on the platform stays
  animal-related: discovery, profiles, community, adoption, transport, fundraising for animal
  welfare, and animal-related products/services/events/education. A new feature request that isn't
  clearly traceable to the animal-ecosystem hierarchy below does not belong on Havenpaw, however
  commercially tempting it might look.

The platform connects: breeders, people looking for a dog, existing animal owners, foundations,
shelters, rescue organisations, transport customers, transport operations employees, drivers, and
administrators. A single person can hold several of these roles at once (see `DOMAIN_MODEL.md` —
`user_roles` is additive, not a single account type).

## Primary hierarchy

This is the platform's permanent scope, in priority order. Later phases exist to serve earlier
ones, not the other way around:

1. **Animal discovery and marketplace** — finding a puppy, an adoptable dog, or a litter.
2. **Breeder, foundation and public user profiles** — who you're dealing with, and why you can
   trust them.
3. **Social feed, communication and community** — following, posting, messaging.
4. **Applications, reservations, adoption and handover** — the actual transaction/relationship.
5. **Integrated Havenpaw transport after a purchase or adoption** — the natural next step once an
   animal has a new home to go to.
6. **Standalone animal transport requests** — transport as a real, independently useful service,
   for people who aren't buying/adopting through Havenpaw at all.
7. **Verified-organisation fundraising for animal welfare and adoption transport** — see
   `docs/FUNDRAISING_POLICY.md` for the full policy.
8. **Animal-related services, products, events and education** — a real future differentiator, kept
   strictly within the animal ecosystem (see "It is not: a general marketplace" above).

**The main customer journey**: find an animal → inspect the breeder or organisation → communicate →
apply or express interest → agree the purchase or adoption → choose collection or Havenpaw transport
→ complete the handover. Transport is a strong, differentiating advantage available at the right
moment in this journey — never the first thing a visitor is asked to do.

## Core product pillars

### 1. Dog and breeder discovery

Customers can search for puppies, view planned litters, search breeders on a map, filter by breed/
country/distance/availability, view breeder achievements and champion dogs, apply for a puppy, and
— once a purchase is agreed — connect the animal with a transport request.

### 2. Professional breeder profiles

Breeders present kennel history, breeds, parent dogs, litters, puppies, champion dogs, titles,
awards, diplomas, health-testing programmes, notable offspring and transport availability. Claims
and achievements are always labelled with their verification state — breeder-provided, evidence
uploaded, waiting for review, verified, rejected — never presented as uniformly "verified."

### 3. Foundations and adoptions

Verified foundations, shelters and rescue organisations publish animals for adoption. Adoption
listings stay visually and structurally distinct from commercial breeder listings — different
language ("adoption fee", "new home"), different verification path. When an approved organisation or
adopter can't fully cover an eligible transport, a verified-organisation fundraiser (pillar 7) can
help close the gap — never a way to fund the adoption/purchase price itself.

### 4. Community

Professional profiles, posts, follows, comments, breed groups, transport-route groups, internal
messaging, route announcements. Real, ongoing product work — not gated behind transport being
"proven" first (an earlier framing this document has corrected away from).

### 5. Animal transport logistics

Users submit animal transport requests — either as the natural next step after a purchase/adoption
(pillar 5 of the hierarchy above) or as a genuinely standalone service (pillar 6) for anyone who
needs safe animal transport regardless of how they found their animal. The company reviews the
request, verifies the required information, prepares a quotation, plans the route and performs the
transport.

Transport services: **shared**, **individual**, **express**, **VIP**. All four meet the same legal
and animal-welfare requirements — VIP means privacy, scheduling and communication, never a higher
minimum standard of care.

AI may later assist with: matching requests to planned routes, estimating prices, suggesting route
combinations, identifying missing information, detecting document issues, predicting available
capacity, and finding return-route opportunities (**noted idea, not yet built**: breeders or private
individuals post that they need a transport in a given window; an AI matching pass tries to fit
that request into the existing planned schedule/capacity and surfaces "we can likely help around
this date, indicative price X" before a human confirms it). AI produces **recommendations only** —
final transport approval, legal assessment, route approval and quotation approval stay under human
(ops staff / admin) control, always.

### 6. Verified-organisation fundraising

See `docs/FUNDRAISING_POLICY.md` for the complete policy. In short: only verified non-profit
organisations (foundations, registered associations, shelters, rescues) may create fundraisers,
never private individuals; fundraising never funds the purchase of an animal, only transport and
related animal-welfare costs; and collected funds are applied directly to the connected Havenpaw
transport balance, never freely withdrawable by an adopter or other private person.

## Geographic direction

The architecture supports multiple European countries, currencies, languages, units and legal
requirements from the schema level up (see `DOMAIN_MODEL.md` — country/currency are plain fields
today, not hardcoded enums, specifically so this doesn't require a schema rewrite later).

**Initial operational focus**: Poland, Germany, Netherlands, Belgium.
**Initial languages**: Polish, English.
**Initial currencies**: PLN, EUR.

We do **not** attempt to fully operationalise every European country in the first release. A
per-country legal knowledge base (breeding rules, sales rules, transport/vaccination/chipping
requirements, import/export rules, non-EU special cases like the UK/Norway/Switzerland) is a
real, large differentiator worth building — but it is explicitly staged for a later phase, not
attempted up front. See `DECISIONS.md`.

## Design direction

Preserve the existing professional Havenpaw visual identity (typography, spacing, restrained
colour, existing shadcn component set). The platform should feel **emotionally warm, trustworthy,
professional, and fully focused on animals** — European, premium-but-not-fake-luxury — appropriate
for breeders, adopters, foundations and transport customers alike. Warmth and professionalism are
not in tension here: the goal is a platform a first-time adopter finds welcoming and a professional
breeder or transport customer finds credible, at the same time.

Avoid: excessive paw graphics, cartoon dogs, childish copy, generic pet-shop design, excessive
gold/trophy decoration, "add to cart" language, unsupported legal guarantees, inflated statistics,
and — per the corrected scope above — any visual or navigational hierarchy that presents transport
as Havenpaw's primary identity rather than one of its real advantages.

## Staged roadmap (high level — see IMPLEMENTATION_PLAN.md for the working phase order and current,
verified per-phase status)

**Status current as of 2026-07-22 — see `docs/IMPLEMENTATION_PLAN.md` for the detailed, per-phase
breakdown and `docs/MVP_TEST_REPORT.md` for the verification evidence behind each "done" below.**

1. **Foundation** — schema, auth/roles, local Supabase, homepage/nav, core transport request flow.
   **Done.**
2. **Transport operations** — ops dashboard, document/status workflow, quotations. **Done**
   end-to-end; document *library UI* (as opposed to the operational document/status workflow) is
   still a placeholder — see phase 10 below.
3. **Route planning & fleet** — planned routes, shared-transport capacity, vehicles, drivers.
   **Done.** The dedicated operations calendar/timeline view over this data is still a placeholder.
4. **Marketplace on real data** — puppies/litters/breeders off Supabase instead of mock data,
   publication-category restrictions (breeder vs adoption vs private rehoming). **Done** — confirmed
   by code inspection, zero `mock-data.ts` data imports remain in any marketplace page.
5. **Foundations & adoption workflows**, **private rehoming** review. **Done**, except the
   foundation welfare-urgent flag/intake flow and foundation team/volunteer management, both still
   placeholders.
6. **Trust & moderation** — reporting, moderation cases. **Done.**
7. **Community & messaging**. **Messaging done** (real conversations gated by relationship-checking
   RPCs). **Community partially done** — a real public post/like/comment feed exists; groups
   (`groups`/`group_members`) remain schema-only, no UI.
8. **Discovery upgrades** — breeder map, guided "find your ideal dog" search. **Done.**
9. **Breeder achievement & champion-dog profiles**. **Done.**
10. **Verified-organisation fundraising** — see `docs/FUNDRAISING_POLICY.md`. **Policy defined,
    not yet built.** Stays behind a feature flag until a real payment provider, refund rules and
    legal texts are approved — no Havenpaw wallet, no personal/purchase fundraising.
11. **Internationalisation** — additional countries/languages/currencies, legal knowledge base.
    **Not started** beyond schema readiness (`preferred_language`/`preferred_currency` columns
    exist; no translation infrastructure or additional-locale copy exists yet).
12. **Later / explicitly out of scope for now** — AI matching/pricing/translation/fraud-detection,
    insurance, instalment credit, escrow payments, vet/groomer/hotel directories, online training,
    exhibition calendar, service marketplace (behaviourists, trainers, photographers), multi-species
    support, a European market/locale registry. Animal-related products/services/events/education
    (hierarchy pillar 8) are real ideas worth keeping on the list, not commitments for the near-term
    build — and, per "What Havenpaw is" above, never an opening to add unrelated general-marketplace
    categories.
