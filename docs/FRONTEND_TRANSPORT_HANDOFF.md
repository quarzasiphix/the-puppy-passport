# Frontend transport handoff contract

Documents how the public marketplace hands a visitor off into the transport request flow today,
and what changed this session — all frontend-only, no `src/lib/queries/transport.ts` or any other
backend-owned transport file was read or modified to write this (this doc was written from reading
`_public.transport.request.tsx`'s existing, working query-param handling only).

## The existing contract (already working, not new)

`/transport/request` accepts an `?animalId=<uuid>` query parameter. On mount, it reads
`window.location.search` directly (`_public.transport.request.tsx:433`, not a
`validateSearch`-typed loader param) and pre-fills the request's purpose/pickup context from that
animal. Any page can link into this flow with:

```tsx
<Link to="/transport/request" search={{ animalId: someAnimalId }}>
  Check transport options
</Link>
```

### Where this CTA already existed before this session

- **`/puppies/$id`** — a full "Transport" tab plus a sidebar "Transport" button, both linking to
  `/transport/request` with the puppy's id.

### Where this CTA was missing (fixed this session)

- **`/adoptions/$id`** — showed a "Transport available" badge (`a.transportAvailable`) but had
  **no way to actually act on it**. An adopter interested in a rescue dog with transport available
  had to navigate to the generic `/transport/request` page and manually figure out which animal to
  reference, if they realised the connection was possible at all. Added a "Transport" card to the
  sidebar (shown only when `a.transportAvailable` is true) with the same honest sequencing wording
  established in the Phase 7 foundation-profile work — arranged only after adoption approval/
  handover agreement, never automatic, exact address stays private until the transport request
  itself — and a "Check transport options" button linking to `/transport/request?animalId=<id>`,
  mirroring the puppy detail page's existing pattern exactly.

### Where this CTA is intentionally still absent

- **`/foundations/$slug`** and **`/breeders/$slug`** already have their own "Transport" tab
  (foundation profile: honest sequencing copy + "See transport options" → `/transport`, the general
  comparison page, not a specific animal; breeder profile: same). These are *organisation*-level
  pages with no single animal in context, so linking to the general `/transport` page (not a
  specific `?animalId=`) is the correct, honest behaviour there — not a gap.
- **Private rehoming** listings go through the same `/adoptions/$id` component and now get the same
  transport card when `transport_available` is true, with `handover` substituted for `adoption` in
  the copy (`a.category === "private_rehoming" ? "the handover is agreed" : "your adoption is
  approved"`).

## What a future backend integration would need to change here

Nothing in this handoff *requires* a backend change — the `?animalId=` contract already works
end-to-end today. The items below are about what happens *after* this handoff, which the backend
session may be actively changing:

- **Expected authentication**: `/transport/request` today works for both signed-in and signed-out
  visitors (per its own existing form) — if the backend session changes eligibility rules (e.g.
  requiring a confirmed application before transport can be requested for a specific animal), the
  frontend CTA added this session would need a corresponding eligibility check before rendering,
  not a full backend query import.
- **Expected redirect**: none currently — `/transport/request` is a standalone page, not a modal or
  a step embedded in the animal detail flow.
- **Loading/pending state**: owned entirely by `_public.transport.request.tsx` itself, not touched
  this session.
- **Quote-not-accepted / scheduling-not-confirmed wording**: already handled inside
  `_public.transport.request.tsx` and the buyer transport dashboard, neither touched this session
  (both are backend-adjacent files this session was scoped to leave alone).

## Isolated presentation components

None were created this session. The existing `?animalId=` link-based handoff is simple enough (a
`Button`/`Link` pair with conditional copy) that introducing new components
(`TransportOptionCard`/`TransportHandoffNotice`/`TransportEligibilityMessage`) for a single new
usage site would have been premature abstraction — three near-identical call sites (puppy detail,
now adoption detail, and the two organisation-profile "Transport" tabs) don't yet share enough
structure to justify one, and forcing them into a shared component now would risk hiding real
differences (animal-specific vs. organisation-general) behind a false abstraction. If a fourth or
fifth call site emerges with the same shape, extracting one then would be the right call.
