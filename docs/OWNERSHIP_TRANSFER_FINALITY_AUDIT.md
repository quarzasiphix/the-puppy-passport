# Ownership-transfer finality audit (Stage YR-11)

## Not applicable — ownership transfer is not a real, executable workflow in this app yet

Checked directly, not assumed:

- `animal_ownership_history` has **no INSERT policy for anyone** (Stage XR-6 already found and
  documented this: "admins manage all ownership history" was split into read-only for admins, and
  no INSERT path was ever added for anyone — deliberately, since XR-6's own test proves "no role
  can insert" as the strongest possible proof of the table's current write-lock). Grepped every
  migration and every query file: zero code anywhere inserts into this table.
- `animals.owner_profile_id` is only ever **set once**, at animal creation
  (`submitRehomingRequest()` in `rehoming.ts`, and the equivalent breeder/foundation listing
  creation paths) — grepped every query file for `owner_profile_id:` as an update target and found
  none. No code path anywhere reassigns an animal's owner after creation.
- `advance_transport_job_status()` — the RPC that drives a transport job through `delivered` →
  `handover_confirmed` → `completed` — only ever touches `transport_requests.status` and
  `transport_status_history`. It never reads or writes `animals.owner_profile_id`,
  `organization_id`, or `animal_ownership_history`. A completed handover/delivery today has **no
  connection at all** to any ownership-state change.
- `convert_application_to_reservation()` sets `animals.availability_status = 'reserved'` (Stage
  IR-6) but likewise never touches ownership fields — a reservation is a commercial commitment, not
  a transfer.

There is, today, no real feature anywhere in this app that actually transfers an animal's
ownership from one profile/organisation to another. The schema for it exists
(`animal_ownership_history`, correctly locked down) and the individual pieces that would
*eventually* feed into it (reservation, transport delivery, handover confirmation) each work
correctly in isolation, but nothing connects them into an actual "ownership now belongs to the
buyer" state change.

## Why this isn't fixed here

Building a full ownership-transfer workflow (deciding when transfer legally/product-wise occurs —
on reservation? on delivery? on handover confirmation? does it require both parties' consent? does
it interact with the existing `private_rehoming` review flow differently than a commercial
`breeder_puppy` sale?) is a substantial, undecided product design question, not a hardening gap
with an obvious smallest-safe-fix. This is squarely the same "speculative infrastructure with no
reachable product workflow" this session's standing discipline avoids building unprompted — every
one of this stage's own concerns (double-transfer prevention, concurrent-completion races,
dispute-evidence preservation) is a property of a workflow that doesn't exist to have those
properties yet. Confirmed genuinely not applicable, not skipped for lack of effort.

## What a future session should design before this becomes fixable

If/when a real "confirm ownership transfer" feature is built, it should reuse this session's
established patterns directly: a single atomic `SECURITY DEFINER` RPC (not a raw multi-table client
write), a real INSERT policy on `animal_ownership_history` scoped to that RPC's own actor check (not
opened to ops/admin generally), idempotent-retry semantics matching `convert_application_to_reservation()`'s
own precedent, and a decision (recorded in `docs/DECISIONS.md`) on exactly which transport/handover
event triggers it.

## Verification

- No code, migration, or test change this stage — a genuine "confirmed not applicable" audit
  outcome, evidenced above rather than assumed.
