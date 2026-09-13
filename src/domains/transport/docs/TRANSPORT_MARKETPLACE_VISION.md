# Transport marketplace — where this is headed

Written 2026-09-13, after shipping the first slice of it (see "What exists today" below). This is
a product-direction note, not a spec — it exists so a future session (or the product owner
revisiting this in a few months) has the reasoning in one place instead of scattered across chat
history. Keep it grounded in what's actually built; update it as the next slices land instead of
letting it drift into aspiration.

## Where this started

The transport-company dashboard began as a way for a company to organize its *own* multi-stop
runs (`trips`/`trip_stops` — "trip to Netherlands, 6 dogs", pickup/drop-off per animal, a live
checklist). The natural next question, raised by the product owner immediately after that shipped:
if the app already knows which companies have trips planned and where, can it also help *match*
transport supply with demand — instead of everything happening over WhatsApp, Messenger, and
scattered notes?

## What exists today (2026-09-13)

- **Trips** (`trips`/`trip_stops`, org-private): a company's internal multi-stop dispatch tool.
  Per-stop pickup/drop-off Maps links, address text, primary contact, and now (`trip_stop_contacts`)
  any number of additional contacts with a free-text role and a messenger handle — real handovers
  often involve a breeder, the person meeting the van, and sometimes a third person.
- **Public trip visibility** (`public_trips` view, opt-in per trip): a company can publish a trip's
  geography/date/status/stop-count — never addresses, contacts, or driver/vehicle identity, mirroring
  the same safety boundary the ops-only `public_routes` view already established.
- **A verified transport-company directory** (`/transport-companies`, `listApprovedTransportCompanies()`):
  the "verified transporters wall" the product owner asked for, structurally identical to the
  existing `/breeders` and `/foundations` directories — same approval gate
  (`verification_status = 'approved' and is_public`), same card/filter UI.
- **A lightweight join-request flow** (`trip_join_requests`): a customer or another company browses
  public trips on the redesigned `/planned-routes` page ("Anemalo routes" / "Company trips" tabs)
  and asks to put an animal on a specific trip — pickup/dropoff/contact only, no legal/compliance
  questionnaire. The owning company accepts (which creates a real stop in one action) or declines,
  with narrow purpose-built notifications on both sides of the loop — deliberately not routed
  through the shared `create_notification_if_enabled()` RPC, whose authorization is hard-locked to
  three unrelated cases.

## Where this is headed (not built yet, roughly in order)

1. **A fleet/route-optimization layer using a real mapping API.** Today every Maps reference is a
   pasted link — no geocoding, no distance calculation exists anywhere in the transport domain
   (confirmed by reading `pricing.ts`'s `approximateDistanceBand()`, which is plain country-string
   equality). The product owner's own framing is "eventually": once trips carry real
   geocoded stops, a routing algorithm (most plausibly the Google Maps Directions/Distance Matrix
   API) could suggest the most efficient stop order for a multi-animal trip — the fleet-dispatch
   equivalent of what the current UI asks a human to sequence by hand. This is real, separate
   engineering work (a geocoding step, storing lat/lng, a distance/duration matrix, an optimization
   pass) and shouldn't be started before the simpler, already-built browsing/matching flow has real
   usage to learn from.
2. **A scored matching engine between customer requests and company trips.** The ops side already
   has one (`matching.ts`'s `computeMatch`), but it matches `transport_requests` against the
   ops-planned `routes` table using structured origin/destination/date fields — it has no concept
   of `trips` at all. Building an equivalent for "does this customer's ask fit that company's trip"
   is a second, separate matching engine, not a reuse of the first. The current pass deliberately
   substitutes *browsable and filterable* (country filters on `/planned-routes`) for *scored and
   automatic* — enough to answer "is anyone already going that direction," not enough to rank or
   auto-suggest matches. Revisit once there's real trip-publishing volume to justify it.
3. **"Join in for cheaper" as an actual cost-sharing mechanic.** Today this is framing only — a
   request to join an existing trip, no fare-splitting, no payment integration. Real multi-party
   billing (who pays what share, refunds if a leg falls through, disputes) is a substantial
   initiative in its own right and shouldn't be bolted onto the join-request flow as an
   afterthought — it needs its own design pass once there's evidence the matching flow itself gets
   used.
4. **Generalizing beyond countries.** `origin_country`/`destination_country` on `trips` are the
   coarsest possible geography, chosen deliberately to avoid needing real geocoding for v1. Once (1)
   above exists, trip-level geography can get more precise (region/city, or an actual route
   polyline) without changing the public-visibility privacy boundary — the `public_trips` view's
   column list stays the contract to preserve regardless of how much richer the underlying `trips`
   row gets.

## How this fits `docs/PRODUCT_VISION.md`

Transport stays "a major advantage of the platform, not its primary identity" — the priority
hierarchy in `PRODUCT_VISION.md` is unchanged by any of this. The transporter directory and public
trip browsing are additive discovery surfaces, not a pivot toward an open marketplace where any
transporter can freely pick up any job — every surface here still gates on the same
`verification_status = 'approved'` approval every other public listing (breeder, foundation) uses,
and a join request is always accepted or declined by a human at the owning company, never
auto-assigned.
