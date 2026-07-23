# Transport Draft Integration Contract

For the frontend work (marketplace purchase buttons, adoption approval flows, private-rehoming
approval flows) that will eventually call the backend entry points built in
`src/lib/queries/transport.ts` during the transport-domain-hardening pass. **No UI calls any of
these yet** — this document is the contract a future UI integration needs, written so that work can
happen without re-deriving the backend's rules from scratch. See `docs/adr/TRANSPORT_DATA_MODEL.md`
for the full architecture background.

Every entry point below is a thin, purpose-specific wrapper around one shared, atomic RPC —
`create_transport_draft()` (`supabase/migrations/20260101006700_create_transport_draft_rpc.sql`,
hardened by `20260101007200_transport_draft_animal_entitlement_check.sql`). None of them submits,
schedules, quotes, or confirms anything. Every one creates a `transport_requests` row with
`status = 'draft'` — always, regardless of what's passed in, enforced server-side — plus its
`transport_request_animals` row(s) and `transport_parties` row(s), in a single transaction. A
network failure partway through cannot leave an orphan request with no animal/party data.

## Auth requirement

Every entry point requires an authenticated caller (`auth.uid()` — enforced inside the RPC, not
just by RLS). There is no anonymous or service-role path. The caller becomes
`transport_requests.requester_profile_id` and gets an automatic `'requester'` row in
`transport_parties` — this is never something the caller passes in.

## Shared error shape

All four functions below throw the underlying Supabase/Postgres error object on failure (same
convention as every other function in `src/lib/queries/transport.ts` — `if (error) throw error`).
Known rejection cases, all raised with `errcode = 'P0001'` (shows as a plain-text `message` on the
thrown error):

| Cause | When it fires |
|---|---|
| "must be authenticated to create a transport draft" | No signed-in user |
| "the requester party row is added automatically and must not be passed in `p_parties`" | A caller tries to pass an explicit `'requester'` party |
| "only the requester themselves can be named as `%` via a profile id..." | A bare `profile_id` (not `organisation_id`) is given for `legal_owner`/`sender`/`payer` and it isn't the caller's own id |
| "you do not have a registered connection to this animal..." | An `animal_id` is supplied that the caller doesn't own, isn't an org member for, and has no `buyer_applications`/`reservations` row naming them as buyer for |

A future UI should catch these and show a plain-language message — never the raw Postgres error
text to an end user (see the project's customer-facing-copy rule in `CLAUDE.md`).

## 1. Standalone (existing, unchanged reference point)

`createTransportDraft({ request, animals, parties })` — the general-purpose function every other
entry point below calls internally. Direct callers pass a curated `request` object (any subset of
`transport_requests`' route/compliance/service/declaration columns — `requester_profile_id` and
`status` are always server-controlled and silently ignored if passed), an `animals` array (each
element either `{ animal_id }` for a registered animal or an inline snapshot for one that isn't —
see `TransportDraftAnimalInput`), and a `parties` array (`TransportDraftPartyInput[]`, never
including `'requester'`).

- **Returns**: the new `transport_requests.id` (`string`).
- **Redirect target**: the standalone 7-step form's own resume/edit route for a draft
  (`/transport/request?draft={id}` pattern — confirm against the current route file at
  integration time, since this doc doesn't own that route).
- **Privacy**: `request.pickup_address_exact`/`destination_address_exact` are private-operational
  from creation — never render them back to any non-owner/non-ops caller.

## 2. Marketplace purchase — `createTransportDraftForMarketplacePurchase(input)`

```ts
createTransportDraftForMarketplacePurchase({ animalId: string }): Promise<string>
```

- **Who calls it**: the buyer, once their `buyer_applications`/`reservations` row for this
  `animalId` is approved. The animal-entitlement check inside `create_transport_draft()` requires
  exactly this — a buyer with no approved application/reservation for `animalId` gets the
  "no registered connection to this animal" error.
- **What it assembles**: `request_purpose: 'purchased_puppy'`, `ownership_changing: true`; one
  animal (the registered `animalId`, snapshot fields copied from the live `animals` row at call
  time — name/sex/weight/size only, nothing private); if the animal has an `organization_id`, a
  `'sender'` party naming that organisation automatically — **the buyer never re-enters who the
  breeder is**.
- **Required input**: `animalId` only. The buyer's own identity comes from their session.
- **Returns**: the new draft's id.
- **Redirect target**: wherever the draft-editing/review UI for a marketplace-originated transport
  lives (not yet built — Phase 5 UI wiring is separate, out of this backend pass's scope).
- **Wording constraint**: never say "your transport is booked" — this only creates a draft. Copy
  should read like "We've started a transport request for &lt;animal name&gt; — review and submit it
  when you're ready," matching the `CLAUDE.md` submission-flow rules (draft vs. submitted vs.
  accepted, never collapsed).

## 3. Foundation adoption — `createTransportDraftForFoundationAdoption(input)`

```ts
createTransportDraftForFoundationAdoption({
  animalId: string;
  adopterProfileId: string;
}): Promise<string>
```

- **Who calls it**: either the foundation (on the adopter's behalf) or the adopter themselves —
  both are valid; the function doesn't care which one is `auth.uid()` at call time, since the
  adopter is always represented as `'recipient'` (a role with no forgery restriction, unlike
  `legal_owner`/`sender`/`payer`).
- **What it assembles**: `request_purpose: 'adoption'`, `ownership_changing: true`; one animal (the
  registered `animalId`); a `'recipient'` party naming `adopterProfileId`; if the animal has an
  `organization_id`, both a `'sender'` and a `'legal_owner'` party naming that organisation (an
  adoption transfers legal ownership away from the foundation, so both roles are the same org).
- **Required input**: `animalId`, and `adopterProfileId` — **must be an already-approved adoption
  application's applicant id**. This function does not itself check adoption-application approval
  status (out of scope for the transport RPC — that's the adoption workflow's own gate); the
  caller is responsible for only invoking this once the adoption is genuinely approved. Do not wire
  a UI button to this before the adoption-approval check exists on the calling side.
- **Returns**: the new draft's id.
- **Wording constraint**: "adoption approved" and "transport request started" are two different,
  sequential facts — never present the transport draft's creation as if it were the adoption
  decision itself.

## 4. Private rehoming — `createTransportDraftForPrivateRehoming(input)`

```ts
createTransportDraftForPrivateRehoming({
  animalId: string;
  recipientProfileId: string;
}): Promise<string>
```

- **Who calls it**: the current owner, giving up the animal — assumed to be `auth.uid()` (the
  function doesn't take an explicit "who is the owner" parameter because `create_transport_draft()`
  itself requires a bare `legal_owner` profile id to equal the caller; there's no way to name a
  *different* person's profile as `legal_owner` without their own action, so the owner must be the
  one calling this).
- **What it assembles**: `request_purpose: 'other'`, `ownership_changing: true`; one animal (the
  registered `animalId`); a `'recipient'` party naming `recipientProfileId` (the new owner —
  unrestricted role, no forgery check).
- **Required input**: `animalId`, `recipientProfileId` — **must be an already-approved private
  rehoming match**. Same caveat as foundation adoption: this function does not check the rehoming
  approval workflow's own status; only call it once a match is genuinely approved
  (`rehoming_reviews` or equivalent — confirm the current table name against
  `docs/DOMAIN_MODEL.md` at integration time).
- **Returns**: the new draft's id.
- **Privacy constraint**: do not expose the current owner's or new owner's exact address to the
  other party before a transport is actually accepted and operations has scheduled it — matches
  the platform-wide "public maps must never expose exact private residential addresses" rule.

## What's deliberately not built yet

- No UI button anywhere calls any of these four functions. Building that button is explicitly a
  separate task from this backend pass.
- None of these functions check the calling flow's own approval gate (buyer application approved,
  adoption approved, rehoming match approved) — that's the responsibility of whatever UI code calls
  them, not the transport layer itself. Do not wire a button to one of these without first
  confirming the underlying approval state.
- Multi-animal support exists in the shared `createTransportDraft()` (an `animals` array), but none
  of the three specific entry points above accept more than one animal yet — each takes a single
  `animalId`. Extending them to accept `animalId[]` is straightforward (mirror the same snapshot-
  copy logic per element) but not done here since no real UI need for it has been identified yet
  (a buyer purchasing multiple puppies from one breeder in one transaction, for example).
