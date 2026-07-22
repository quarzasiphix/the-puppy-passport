# Havenpaw — Product Vision

## What Havenpaw is

Havenpaw is a professional European animal marketplace, breeder network, community and animal
transport logistics platform.

It is **not**:
- a generic OLX clone;
- a pet shop;
- a childish dog website;
- an unmoderated Facebook group;
- an open marketplace where random transporters can accept jobs.

The **primary commercial service is animal transport**, performed by the platform owner's transport
company. Breeder listings, adoption listings, private rehoming and community features are
supporting pillars that lead customers toward — and are strengthened by — the transport workflow.

The platform connects: breeders, people looking for a dog, existing animal owners, foundations,
shelters, rescue organisations, transport customers, transport operations employees, drivers, and
administrators. A single person can hold several of these roles at once (see `DOMAIN_MODEL.md` —
`user_roles` is additive, not a single account type).

## Core product pillars

### 1. Animal transport logistics

Users submit animal transport requests. The company reviews the request, verifies the required
information, prepares a quotation, plans the route and performs the transport.

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

### 2. Dog and breeder discovery

Customers can search for puppies, view planned litters, search breeders on a map, filter by breed/
country/distance/availability, view breeder achievements and champion dogs, apply for a puppy, and
connect a selected puppy with a transport request.

### 3. Professional breeder profiles

Breeders present kennel history, breeds, parent dogs, litters, puppies, champion dogs, titles,
awards, diplomas, health-testing programmes, notable offspring and transport availability. Claims
and achievements are always labelled with their verification state — breeder-provided, evidence
uploaded, waiting for review, verified, rejected — never presented as uniformly "verified."

### 4. Foundations and adoptions

Verified foundations, shelters and rescue organisations publish animals for adoption and submit
transport requests. Adoption listings stay visually and structurally distinct from commercial
breeder listings — different language ("adoption fee", "new home"), different verification path.

### 5. Community

Future: professional profiles, posts, follows, comments, breed groups, transport-route groups,
internal messaging, route announcements. **The full social layer is not built before the transport
workflow is operational** — see the phase order in `IMPLEMENTATION_PLAN.md`.

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
real, large differentiator worth building — but it is explicitly staged for a later phase once the
transport workflow itself is proven, not attempted up front. See `DECISIONS.md`.

## Design direction

Preserve the existing professional Havenpaw visual identity (typography, spacing, restrained
colour, existing shadcn component set). The platform should feel trustworthy, operational,
professional, European, premium-but-not-fake-luxury — appropriate for breeders and international
transport customers.

Avoid: excessive paw graphics, cartoon dogs, childish copy, generic pet-shop design, excessive
gold/trophy decoration, "add to cart" language, unsupported legal guarantees, inflated statistics.

## Staged roadmap (high level — see IMPLEMENTATION_PLAN.md for the working phase order and current,
verified per-phase status)

**Status current as of 2026-07-22 — see `docs/IMPLEMENTATION_PLAN.md` for the detailed, per-phase
breakdown and `docs/MVP_TEST_REPORT.md` for the verification evidence behind each "done" below.**

1. **Foundation** — schema, auth/roles, local Supabase, transport-first homepage/nav, core
   transport request flow. **Done.**
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
10. **Internationalisation** — additional countries/languages/currencies, legal knowledge base.
    **Not started** beyond schema readiness (`preferred_language`/`preferred_currency` columns
    exist; no translation infrastructure or additional-locale copy exists yet).
11. **Later / explicitly out of scope for now** — AI matching/pricing/translation/fraud-detection,
    insurance, instalment credit, escrow payments, food/accessories marketplace, vet/groomer/hotel
    directories, online training, exhibition calendar, service marketplace (behaviourists,
    trainers, photographers), multi-species support, a European market/locale registry. These are
    real ideas worth keeping on the list, not commitments for the near-term build.
