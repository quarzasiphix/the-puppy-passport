# Transport domain

The largest domain in the codebase — customer-facing transport requests, ops dispatch/matching,
driver job flow, routes/fleet, welfare-case-to-transport conversion, and animal-welfare incident
handling. `services/transport.ts` alone is 1050 lines / 65 exports, the single largest file in the
app. Backs "the center of the platform" per `docs/DOMAIN_MODEL.md`'s description of
`transport_requests`.

## What this owns

- `transport_requests`, `transport_request_animals`, `transport_parties`,
  `transport_request_amendments`, `transport_status_history`, `transport_documents`,
  `quotations`, `transport_reviews`, `public_transport_rating` — almost entirely in
  `services/transport.ts`: draft creation/save (`createTransportRequest`, `saveDraft`,
  `listMyDrafts`, `deleteDraft`), the customer's own request list/detail/status-history/documents,
  the milestone-label helpers (`transportMilestones`, `milestoneIndexForStatus`, `isOnHold`,
  `isClosed`, `nextActionForStatus` — these back the plain-language customer-facing status
  translation CLAUDE.md requires), quotation response, and the post-delivery review flow
  (`reviewableStatuses`, `getMyReview`, `submitReview`, `getPublicTransportRating`). Amendments and
  submission go through RPCs: `submit_transport_request`, `request_transport_amendment`,
  `review_transport_amendment`, `respond_to_quotation`, `create_transport_draft`
  (`create_transport_draft()` is the single atomic RPC per `docs/DOMAIN_MODEL.md` — creates the
  request + its animals + its parties rows in one transaction).
- `drivers`, `driver_transport_job_view` — `services/driver.ts` (216 lines, 13 exports) — the
  driver's own job list/detail, status advancement (`advance_transport_job_status` RPC). Reads only
  the column-minimized view, never the base table directly with full columns.
- `routes`, `route_stops`, `route_assignments`, `route_waitlist`, `vehicles`, `drivers` —
  `services/routes.ts` (231 lines, 15 exports) and `services/fleet.ts`. Assignment goes through
  `assign_request_to_route`/`assign_driver_to_job` RPCs. `fleet.ts` also has `getDriver`/
  `updateDriver`/`getVehicle`/`updateVehicle` (added 2026-09-14) — plain RLS-gated row read/update,
  no RPC needed since "ops staff manage vehicles/drivers" and "company members manage their own
  vehicles/drivers" are already `ALL`-command policies (`20260101001700_routes_and_fleet.sql`,
  `20260912150000_fleet_multi_tenancy.sql`).
- **Fleet multi-tenancy** (added 2026-09-12, `20260912150000_fleet_multi_tenancy.sql`) — `vehicles`
  and `drivers` gained a nullable `organization_id`. `NULL` stays Anemalo's own internal fleet
  (ops-staff-managed, unaffected); non-null is a `transport_company` org's own fleet. `listVehicles`
  /`createVehicle`/`listDrivers`/`createDriver` (`services/fleet.ts`) are **unmodified and shared**
  by both the internal ops panel (`dashboard/operations/{vehicles,drivers}.tsx`) and the new
  self-service transport-company panel (`dashboard/transport-company/{vehicles,drivers}.tsx`) — no
  client-side org filter needed for reads, since two new RLS policies ("company members manage
  their own vehicles/drivers", `is_org_member()`-gated) already scope a non-ops caller to their own
  company's rows; a create just needs to pass `organization_id` in the insert payload. Also added
  `listMyFleetJobs()` — a company's "Jobs" tab, requests assigned to their own fleet, gated by a
  third new **read-only** RLS policy on `transport_requests` (a company never writes `.status`
  directly; that stays `change_ops_request_status()`/`advance_transport_job_status()`, or the
  individually assigned driver's own `/dashboard/driver` workspace via `is_my_driver_id()`).
- `services/calendar.ts` (268 lines) — "a real view over the existing
  routes/route_stops/route_assignments/vehicles/drivers/transport_requests model — no new
  scheduling tables" (`:1-2`); explicitly the fulfillment of a gap `docs/IMPLEMENTATION_PLAN.md`
  had already flagged as next.
- `services/dispatch.ts` (89 lines) — ops workload view; a small set of "actively on a job"
  statuses defined once here and cross-referenced against `driverStatusSteps` in `driver.ts`.
- `services/matching.ts` (244 lines) — "Deterministic, explainable matching v1. No generative AI,
  no automatic assignment — this only ever produces a suggestion for an operations employee to
  accept or dismiss. Same inputs always [produce the same output]" (`:1-3`).
- `services/pricing.ts` (66 lines) — `pricing_rules` reads, indicative estimate calculation only
  (never a binding quote — quoting is a separate ops-reviewed step per `services/transport.ts`).
- `welfare_cases`, `welfare_case_documents` — `services/welfare.ts` (175 lines, 13 exports).
  `acknowledge_welfare_case`, `review_welfare_case`, and
  **`convert_welfare_case_to_transport_draft`** — a welfare case can become a real transport draft
  via RPC, i.e. animal-welfare intake and the transport pipeline are already linked.
- `audit_logs`, `transport_incidents` — cross-cutting: incident reporting
  (`components/report-incident-dialog.tsx`) and the audit trail every status change writes to.

## File structure

- `index.ts` — re-exports all 10 service files and all 5 components (`ops-request-table`,
  `report-incident-dialog`, `review-transport-dialog`, `transport-document-checklist`,
  `transport-timeline`).
- Services: `calendar.ts`, `dispatch.ts`, `driver.ts`, `fleet.ts`, `matching.ts`, `pricing.ts`,
  `routes.ts`, `transport.ts`, `trips.ts`, `welfare.ts` — described above. `trips.ts` (added
  2026-09-13) is the company-owned Trips feature (`trips`/`trip_stops`/`trip_stop_contacts`,
  plus public visibility via `public_trips` and `trip_join_requests`) — deliberately separate from
  `transport.ts`'s customer-facing `transport_requests` model, see the migration headers
  (`supabase/migrations/2026091{5,6,7}*.sql`) for why.
- `docs/` — domain-local design docs, not part of the top-level `docs/` tree:
  `TRANSPORT_MARKETPLACE_VISION.md` (product direction for the Trips → public-visibility →
  matching → fleet-routing roadmap).
- Components: `ops-request-table.tsx` (the ops dashboard's request list/filter UI),
  `report-incident-dialog.tsx`, `review-transport-dialog.tsx` (post-delivery customer review),
  `transport-document-checklist.tsx`, `transport-timeline.tsx` (customer-facing milestone display,
  presumably consuming `transportMilestones` from `services/transport.ts`).

## Public API

`index.ts` exports the full surface flatly across all 9 services + 5 components.

## Known gaps

- `documentCategoryLabels` (`services/transport.ts`) is a hardcoded `Record<string, string>` — not
  checked in this pass whether it's already i18n'd elsewhere or a genuine gap; same class of issue
  as the label maps already fixed/flagged in other domains this session.
- Given the file's size (1050 lines, 65 exports), this doc's "what it owns" section groups by table
  rather than listing every export — read `services/transport.ts` directly for the exact function
  signature before assuming behavior from this summary alone.
- `qualification_status` (drivers, free text, company-facing) and `internal_verification_status`
  (drivers, enum, ops-facing) are two separate, never-synced columns describing overlapping
  concepts — pre-existing (`20260101001700_routes_and_fleet.sql` /
  `20260101002500_fleet_details.sql`), not reconciled in the 2026-09-14 detail-page pass; both are
  now independently editable (ops edits `internal_verification_status`, a company edits
  `qualification_status`) rather than merged.
- Transport-company job detail (`jobs.$id.tsx`) is read-only and shows no status timeline — a
  company member (not necessarily the individually assigned driver) has no RLS `SELECT` policy on
  `transport_status_history`, only "ops staff view all" and "assigned driver views their own", so
  there was nothing real to render there without a new policy (out of scope for the 2026-09-14
  pass).
- Trip-level `trip_stop_contacts` ("extra contacts" beyond the two primary pickup/dropoff contacts)
  are still only visible per-stop inside `StopDetailDialog` — the new trip Contacts tab
  (`trips.$tripId.tsx`) only aggregates the two primary contacts per stop, not `trip_stop_contacts`,
  to avoid an N+1 query per stop in a list view.
- `org_member_role` already has a `'driver'` value, but `transport-company/team.tsx` deliberately
  excludes it from `invitableRoles` — team invites are for office staff, not drivers. Driver
  account linking instead goes through `drivers.login_email` (below), a separate mechanism.
  Revisit only if the product direction changes to unify these two onboarding paths.

## Driver account linking (added 2026-09-14)

`drivers.profile_id` existed since the original schema (used by `getMyDriverRecord()` to back the
individual `/dashboard/driver` workspace) but nothing in the UI ever set it — every driver record
was a disconnected free-text card. `20260918000000_driver_login_email_link.sql` adds
`drivers.login_email` (plain text, distinct from `drivers.contact` which stays a free-text "how to
reach them" note, not necessarily a login). `resolveProfileIdByEmail()` (`services/fleet.ts`) looks
up `profiles` by email — safe under the existing `"profiles are viewable by any authenticated
user"` RLS policy (`using (true)`, pre-existing, not introduced here). Every driver create/update
call site (`operations/drivers.tsx`, `operations/drivers.$id.tsx`,
`transport-company/drivers.tsx`, `transport-company/drivers.$id.tsx`) now re-derives `profile_id`
from `login_email` on every save — never edited independently, so a changed email always
re-resolves (or un-links) rather than leaving a stale link. No RPC needed since the RLS "manage"
policies on `drivers` are already `ALL`-command.

## Related docs

- `docs/DOMAIN_MODEL.md` — the full transport data model (largest section in that doc), the
  two-trigger post-draft lock-down design, `transport_request_animals`/`transport_parties`
  hardening rationale.
- `docs/IMPLEMENTATION_PLAN.md` — cites the calendar view as a previously-flagged gap, now filled.
- `docs/adr/TRANSPORT_DATA_MODEL.md` — referenced from `docs/DOMAIN_MODEL.md` for the lock-down
  trigger design; not read directly in this pass.

## Last significant change

2026-09-14 (second pass): a domain-wide mobile/desktop responsiveness audit (~35 files read) found
two real, repeatable defects, both fixed: (1) `src/shared/ui/dialog.tsx`'s `DialogContent` had no
`max-height`/scroll, so any dialog with enough fields could render its submit button off-screen
below the fold on a phone with the keyboard open — fixed once, globally, with a purely-defensive
`max-h-[85vh] overflow-y-auto` default (only engages when content actually overflows); (2)
`operations/requests.$id.tsx`'s field `Grid` helper and the public `transport.request.tsx` summary
`<dl>` both started at 2-3 columns with no mobile breakpoint — both now default to 1 column. Also
fixed the driver/vehicle/jobs table wrappers in `transport-company/*` to the codebase's standard
two-layer `overflow-hidden` outer + `overflow-x-auto` inner scroll pattern. Also added driver
account linking — see "Driver account linking" above.

2026-09-14 (first pass): gave every previously list-only fleet/welfare entity a real click-through
detail+edit page — drivers and vehicles (both `dashboard/operations/{drivers,vehicles}.$id.tsx` and
`dashboard/transport-company/{drivers,vehicles}.$id.tsx`, sharing the new `fleet.ts` get/update
functions but each with its own route file, matching the pre-existing convention that ops and
company list pages are separately written rather than shared), welfare cases
(`operations/welfare-cases.$id.tsx`, using the previously-unused `getWelfareCase`, now also joining
`organisations(name)`), and a transport-company's own fleet jobs
(`transport-company/jobs.$id.tsx`, new `getMyFleetJobDetail`). Also restructured
`transport-company/trips.$tripId.tsx` into three tabs (Stops / Driver & vehicle / Contacts),
mobile-styled as icon-over-label like the dashboard's own bottom nav bar. Previously: 2026-09-12
fleet multi-tenancy (see "What this owns" above) plus the transport-company dashboard panel itself.
