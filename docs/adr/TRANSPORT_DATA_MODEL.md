# ADR — Transport Data Model

Written during a dedicated transport-domain-hardening pass, immediately after the security-hardening
commits (`ee5cd79`, `b0065be`, `c0851cf`). This is a real architecture decision record, not a design
sketch — every claim about the "current state" below was verified by reading the actual migration
files and the actual application code that queries them (`grep`, direct file reads), not assumed from
older docs. Where an older doc (`docs/IMPLEMENTATION_PLAN.md`) already got this partially right, it's
cross-referenced; where it didn't, this document is the correction.

## 1. Current state (Phase 1 audit)

### `transport_requests` — one big row per request, inline snapshot fields

The 7-step request form (`src/routes/_public.transport.request.tsx`) and `createTransportRequest()`/
`saveDraft()` (`src/lib/queries/transport.ts`) write directly into `transport_requests`'s own ~70
columns: animal snapshot (`animal_name`, `breed_free_text`, `sex`, `weight_kg`, `microchip_number`,
`vaccination_status`, ...), route (`pickup_*`/`destination_*`, both `_approx` and `_exact` variants),
compliance questionnaire answers, and party-adjacent inline columns: `current_owner_profile_id`,
`sender_org_id`, `sender_profile_id`, `recipient_profile_id`, `payer_profile_id`,
`release_authorized_by` (free text), `receive_authorized_by` (free text).

**Verified by reading the form's submit handler directly**: only `current_owner_profile_id`,
`sender_org_id`, `release_authorized_by` and `receive_authorized_by` are ever actually set by the
real UI. `sender_profile_id`, `recipient_profile_id` and `payer_profile_id` exist as columns but are
**never populated by any code path** — there is no way today for a customer to say "the recipient is
this other Havenpaw user" or "someone else is paying." `release_authorized_by`/`receive_authorized_by`
are a single free-text name each — no phone, no email, no structured record.

### `transport_parties` — exists, fully built, RLS-complete, **zero rows, zero callers**

`20260101002400_animals_transport_fields.sql` already defines `transport_parties` (role enum:
`legal_owner`/`requester`/`sender`/`recipient`/`payer`/`pickup_contact`/`delivery_contact`;
`profile_id` / `organisation_id` / `external_name`+`external_phone`+`external_email`, mutually
exclusive via a check constraint) with complete, correct RLS (`requesters manage parties on their own
request`, `named profile parties view their own party row`, `ops staff manage all transport
parties`). **Confirmed via `grep -rln "transport_parties" src/`: the only reference in the entire
`src/` tree is the hand-written type stub in `src/lib/supabase/types.ts` — no query file, no route,
no RPC ever reads or writes this table.** It was built ahead of the UI that would use it and then
never wired up. Two real, previously-undiscovered gaps in its otherwise-solid design:
- The check constraint allows **zero** of `profile_id`/`organisation_id`/`external_name` to be set
  (`num_nonnulls(...) <= 1` permits 0), so a completely empty, meaningless party row is valid today.
- No uniqueness constraint on `(transport_request_id, party_role)` — nothing stops two conflicting
  `payer` rows on the same request.

### Animals: exactly one per request, no way to represent more

`transport_requests.animal_id` is a single nullable FK to `public.animals`. `number_of_animals
integer not null default 1` is a **plain integer the customer types in** — confirmed in the form
(`values.numberOfAnimals`) — with no linkage whatsoever to which additional animals those are. A
request for 3 dogs today can link at most 1 real/snapshot animal record; the other 2 exist only as a
number. There is no `transport_request_animals` or equivalent join table anywhere in the schema.

### Quotations, routes, assignments — sound, but one related gap found in passing

`quotations` and `routes`/`route_assignments`/`route_stops` are correctly modelled and RLS-correct
for this task's purposes (verified, not changed here). **One related, pre-existing RLS gap found
while reading `quotations`'s policies, out of this task's scope but worth recording**: `"requesters
accept or reject their own quotation"` only restricts `WITH CHECK (status in ('accepted',
'rejected'))` — like the transport-status bug fixed in the previous security pass, it does not
restrict which *other* columns (e.g. `total_price`) a requester could change alongside the status.
The real app code (`respondToQuotation()`) never does this, so it's not exploitable through the UI,
only through a raw API call — flagged in `docs/DATABASE_TESTING.md` as a new open item, not fixed in
this pass (out of scope: this ADR is about the transport *data model*, not a second full RLS audit).

### Buyer applications, reservations, adoption, private rehoming — never create a transport request

Confirmed via `grep -rln "createTransportRequest\|from(\"transport_requests\").insert" src/`: the
**only** two places that ever create a `transport_requests` row are `transport.ts`'s two functions,
both called only from the standalone 7-step form. Approving a `buyer_applications` row, creating a
`reservations` row, or approving a private-rehoming `rehoming_reviews` row does **not** create any
transport draft today — a buyer/adopter who wants transport must separately go to `/transport/request`
and start over, manually re-entering the animal and party information a purchase/adoption/rehoming
flow already has on file. This confirms the exact gap Phase 5 is meant to close.

### Documents and driver access

`transport_documents` is keyed only by `transport_request_id` — no notion of which *party* a document
belongs to (an "ownership declaration" and a "pickup authorisation" are both just rows differing by
`category`, not linked to the specific party they concern). Storage objects are keyed by
`{transport_request_id}/...` (fixed this transport-hardening pass's predecessor, see the
column-shadowing fix in commit `ee5cd79`). The driver query layer (`src/lib/queries/driver.ts`)
already does real column minimization at the application level (`select("id, request_number,
animal_name, pickup_city, ..., crate_requirements, behavioural_notes")`, never `select("*")`) — better
discipline than initially assumed. The one live gap: this minimization exists only in application
code, not enforced at the database layer, so a raw API call or a future careless `select("*")` in a
new driver-facing query would silently regain access to payer/owner/compliance fields RLS alone
cannot hide (RLS is row-level, not column-level).

### Audit trail for status changes: real, but nothing else is audited

`changeOpsRequestStatus()` (`src/lib/queries/operations.ts`) already writes a `transport_status_history`
row and an `audit_logs` row on every status change (three separate client calls, not atomic — a
pre-existing pattern used elsewhere in this codebase, not changed here). Nothing else about a
transport request — who was named as a party, what animal snapshot was submitted, any post-acceptance
edit — is audited today, because nothing currently *can* be edited after submission (see below).

### No post-submission edit protection exists yet (and none is currently needed by real UI)

Confirmed: no customer-facing UI ever calls `.update()` on `transport_requests` except the request
form itself (drafts only) and `respondToQuotation()` (which only ever sets `status`). This means a
snapshot-field lock introduced now cannot break any existing real user flow — it only closes a gap
that was never exercised by legitimate code, exactly the kind of hardening this task asks for.

## 2. Options considered

**1. Inline snapshots only (status quo, do nothing).** Rejected: cannot represent multiple animals,
cannot represent a real recipient/payer distinct from the requester, cannot audit party-level
changes, and leaves `transport_parties` as permanent dead schema.

**2. Fully normalised parties and animals (drop the inline snapshot columns, everything joins out).**
Rejected outright by the task brief ("do not delete legacy inline fields") and independently rejected
on the evidence: the existing inline columns are load-bearing for `ops`'s detail page, the driver
workspace, the buyer dashboard, and 20+ existing passing tests. A full normalisation would also lose
the deliberate "immutable snapshot of what was true at booking time" property — if `animal_id` were
the *only* record and the linked `animals` row later changed (weight updated, re-homed, deleted), a
fully-normalised model would silently rewrite history for a transport that already happened.

**3. Hybrid: inline columns stay as the booking-time snapshot of the *first/primary* animal and
party set (100% backward compatible); real linkage lives in new/existing side tables
(`transport_parties`, a new `transport_request_animals`) for anything the inline columns cannot
represent (additional animals, a real recipient/payer distinct from the requester, external
contacts with a full profile instead of one free-text name).** Selected. This is what the task brief
suggested as the likely answer, and the audit confirms it's correct for this schema specifically:
the inline columns are already exactly a booking-time snapshot in practice (nothing overwrites them
after submission in real usage), and `transport_parties` was already built to be exactly the
"structured, reusable, more-than-one-of-a-kind" side table this model needs — it just needed backfill,
a real writer, and two small integrity fixes (see below).

## 3. Selected model

### Canonical reusable records (already exist, unchanged)
`animals`, `profiles`, `organisations` — the actual reusable entities. Linking to them (via
`transport_request_animals.animal_id`, `transport_parties.profile_id`/`organisation_id`) never
copies their private fields; RLS on those tables independently governs who can see what a link
merely points at.

### Booking-time immutable snapshots (existing inline columns — untouched, still written once at
submission, now enforced as read-only after `draft`)
Every animal/route/compliance/service/declaration column already on `transport_requests`, plus the
new `transport_request_animals` snapshot columns for animals 2..N. These represent "what was true
when the customer submitted this," and must survive the linked `animals`/`profiles` row later
changing or being deleted — which is exactly why they're columns, not foreign-key-only.

### Operational mutable data (existing columns, already correctly ops/driver-scoped)
`status`, `compliance_review_result`, `visibility`, `assigned_route_id`/`assigned_vehicle_id`/
`assigned_driver_id` — already locked to ops staff/assigned driver by the previous security pass
(`20260101006000_lock_transport_request_operational_fields.sql`). Unchanged here.

### Public approximate vs. private exact data (existing columns, unchanged)
`pickup_city`/`pickup_area_approx`/`destination_city`/`destination_area_approx` vs.
`pickup_address_exact`/`destination_address_exact` — the existing split is correct and untouched;
this ADR does not add new address fields.

### New: reusable party records (`transport_parties`, now actually used)
One row per real party beyond the requester (who stays on `transport_requests.requester_profile_id`
directly, as today): `legal_owner`, `sender`, `recipient`, `payer`, `pickup_contact`,
`delivery_contact`, each pointing at a `profile_id`, an `organisation_id`, or a full external contact
(name **and now phone and email**, not just the one free-text field the inline columns offered).

### New: explicit animal linkage (`transport_request_animals`)
One row per animal on the request (position 1..N), each either linked to a real `animals.id` or
carrying its own inline snapshot for an animal never registered in Havenpaw — finally giving
`number_of_animals > 1` an actual, safe, queryable representation.

### New: a deliberate amendment workflow (`transport_request_amendments`)
Once a request leaves `draft`, its booking-time snapshot columns become read-only to the requester
(enforced by a new trigger, mirroring the operational-field lock from the previous security pass).
A customer who needs to change a contact detail, address, or date after submission calls
`request_transport_amendment()` (files a pending, auditable proposed change) instead of writing the
column directly; ops calls `review_transport_amendment()` to approve (applies the change) or reject.

## 4. How each required scenario is represented

| Scenario | Representation |
|---|---|
| One or multiple animals | `transport_request_animals`, one row per animal, `position` orders them |
| Registered animal | `transport_request_animals.animal_id` set, snapshot columns optionally filled from it at creation time |
| Unregistered animal | `transport_request_animals.animal_id` null, snapshot columns hold the customer's own description |
| Requester ≠ owner | `transport_requests.requester_profile_id` (always the submitter) vs. a `legal_owner` row in `transport_parties` |
| Sender ≠ owner | a `sender` row in `transport_parties` (`profile_id`, `organisation_id`, or external) |
| Recipient ≠ adopter/buyer | a `recipient` row in `transport_parties` — finally representable; previously only a null column |
| Payer ≠ recipient | a `payer` row in `transport_parties` — finally representable |
| External people, no account | `transport_parties.external_name`/`external_phone`/`external_email`, `profile_id`/`organisation_id` both null |
| Organisation-owned animals | `transport_request_animals.animal_id` → `animals.organization_id`; a `sender`/`legal_owner` `transport_parties` row can also carry `organisation_id` directly |
| Breeder sale / foundation adoption / private rehoming / standalone | four Phase-5 entry points below, all funnelling through one shared creation RPC |
| International addresses | unchanged existing `pickup_country`/`destination_country` columns |
| Approximate public vs. exact private location | unchanged existing `_approx` vs. `_exact` column split |
| Account deletion / GDPR retention | `transport_parties.profile_id`/`transport_request_animals.animal_id` are `on delete set null`-equivalent (the FK itself, see migration) — the party/animal *snapshot* text survives a deleted profile/animal untouched, only the link clears; this is the entire reason snapshot columns exist rather than joins-only |
| Immutable historical quotation/transport records | booking-time snapshot lock trigger (new) + quotations already immutable by convention (unchanged) |
| Auditability | `audit_logs` rows added for amendment review decisions (new); existing status-change auditing untouched |
| Changed contact details after booking | the amendment workflow, scoped explicitly to the contact/address/date fields most likely to change |
| Route assignment and driver access | unchanged; `driver_transport_job_view` (new) adds column-level minimization on top of the existing row-level RLS |
| Documents belonging to the correct transport and party | `transport_documents` gets a new nullable `transport_party_id` column (additive, never backfilled — "do not invent missing information": existing documents have no way to know retroactively which party they belonged to, so they stay unlinked, exactly as before) |

## 5. Explicit non-goals (documented, not silently dropped)

- **No consent/verification flow for named parties.** Naming `profile_id`/`organisation_id` as
  `sender`/`payer`/`legal_owner` is a claim by the requester, not something the named party agrees
  to — identical to how the pre-existing inline `current_owner_profile_id`/`sender_org_id` columns
  already worked. What *is* new: the creation RPC requires that for these three specific roles
  (`legal_owner`, `sender`, `payer`), a bare `profile_id` (not `organisation_id`) must equal the
  requester's own id — a real customer cannot claim an arbitrary *other* Havenpaw user already
  agreed to own/send/pay. Naming another user as `recipient` (or naming an organisation for any
  role) is unrestricted, since that's inherent to "sending an animal to someone else."
- **The quotation column-scoping gap found during the audit is not fixed here** — recorded as a new
  open item in `docs/DATABASE_TESTING.md`, out of this ADR's scope.
- **The driver-job view does not (yet) expose the multi-animal list** — a driver still sees the
  primary/first animal snapshot the same way they always have; extending the minimal view to a full
  animal list is left as documented future work, not silently promised as done.
- **No UI wiring for the four Phase-5 entry points.** They are real, tested backend functions/RPCs
  ready for a future UI to call; no button in the app calls them yet (explicitly out of scope for
  this pass — see `docs/IMPLEMENTATION_PLAN.md`).
