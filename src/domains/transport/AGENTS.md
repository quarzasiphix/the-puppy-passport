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

## Driver account linking (added 2026-09-14, made audited/notifying the same day)

`drivers.profile_id` existed since the original schema (used by `getMyDriverRecord()` to back the
individual `/dashboard/driver` workspace) but nothing in the UI ever set it — every driver record
was a disconnected free-text card. `20260918000000_driver_login_email_link.sql` adds
`drivers.login_email` (plain text, distinct from `drivers.contact` which stays a free-text "how to
reach them" note, not necessarily a login).

Linking goes through `link_driver_account(p_driver_id, p_login_email)` RPC
(`20260919000000_link_driver_account_rpc.sql`), **not** a client-side resolve+update — `audit_logs`
INSERT is RLS-restricted to `is_ops_staff()` only, which would silently block a transport-company
caller from ever recording the audit row for their own driver. The RPC re-derives the exact same
"can this caller manage this driver" condition the `drivers` RLS policies already use, resolves
`profiles` by email (case-insensitive), and — only when the resulting link actually changed —
writes one `audit_logs` row (`driver.account_linked`/`_unlinked`/`_relinked`) and, on a fresh link,
inserts directly into `notifications` for the newly-linked profile (bypassing
`create_notification_if_enabled()`'s own caller-authorization lock, which only permits notifying
yourself/a moderator/your buyer-application's owner — none of which fit an ops/company caller
notifying some other driver; a direct insert is safe here since `'security'`-category notifications
are unconditionally delivered regardless of preference anyway, so it's exactly what that RPC would
have done). `fleet.ts`'s `linkDriverAccount()` wraps the RPC; `resolveProfileIdByEmail()` is gone.
Every driver create/update call site calls `updateDriver()` for ordinary fields and
`linkDriverAccount()` once more for the email, in parallel.

**No email provider exists in this app** (confirmed in
`services/notification-templates.ts`'s own header comment) — "invite an unlinked driver to sign
up" is a **copyable link** (`/signup?email=<address>`, prefilled via `_public/signup.tsx`'s
`validateSearch`), not a sent email. The "Copy sign-up link" button only lives on the two driver
detail pages, not the list cards/rows — the list cards are themselves one big `<Link>`, and a
`<button>` nested inside an `<a>` is invalid HTML with unreliable click behavior.

## Driver reputation + SLA overdue badge (added 2026-09-14)

`transport_reviews.driver_rating` (customer rating the driver) existed since
`20260101004700_transport_reviews.sql` but was never aggregated or shown anywhere.
`getDriverStats(driverId)` (`services/fleet.ts`) reads a completed-job count plus
average/count of `driver_rating`, shown as a "Reputation" card on both driver detail pages.
Needed one new RLS policy — `"company members view reviews for their fleet's jobs"`
(`20260920000000_transport_reviews_fleet_visibility.sql`, an additional permissive SELECT policy,
mirrors the existing fleet-visibility condition on `transport_requests` itself) — since a company
had no way to read reviews for its own driver's jobs before this.

`isOverdue(status, latestDate)` (`services/transport.ts`) is a pure computed flag (past
`latest_date`, not closed, not completed) — no schema/cron needed, since this app has no
scheduled-function infrastructure; "SLA alerting" is a badge on `OpsRequestTable`
(`components/ops-request-table.tsx`), the shared component already reused by 5+ ops list pages, so
it surfaces everywhere at once rather than needing a push.

## Ops bulk actions + two-way rating (added 2026-09-14)

`OpsRequestTable` gained row checkboxes + a bulk status-change bar (calls the existing
`change_ops_request_status` once per selected row via `Promise.all` — no new bulk RPC, ops
selections are realistically tens of rows). `operations/welfare-cases.tsx` got the matching
bulk-acknowledge. Neither exists on the phone-width card views (a multi-select workflow doesn't
translate well to touch, and those cards are themselves full-width `<Link>`s).

The two-way half of the review system: `driver_reviews` (new table,
`20260921000000_driver_reviews.sql`) lets the individually assigned driver report back
`animal_as_described`/`pickup_access_ok`/`paperwork_ok`/`comment` for a job — separate from
`transport_reviews`, which is the customer rating the driver. RLS mirrors the identity check
`transport_status_history` already uses (`is_assigned_driver_for_request()`), plus the same
ops/company visibility shape as the new `transport_reviews` policy. `driver.ts`'s
`submitDriverReview()`/`getMyDriverReview()` back a compact prompt on `dashboard/driver/index.tsx`,
shown once a job reaches `handover_confirmed`/`completed` and no review exists yet.

## Ops route planning (added 2026-09-14)

`routes.vehicle_id`/`driver_id` and the `route_stops` table have existed since the original schema
(`20260101001700_routes_and_fleet.sql`) — `route_stops` was already read by the driver's own
workspace and the calendar view — but nothing in the app ever wrote to any of them. Ops "Routes"
could only create a route shell and attach *existing* transport requests to it.
`20260922000000_route_stops_planning_fields.sql` adds `animal_label`, `transport_request_id`
(nullable — a stop can represent an animal that isn't a formal request yet), `address_text`,
`maps_url`, `contact_name`, `contact_phone`, `notes` to `route_stops`, bringing it to the same
planning shape `trip_stops` already has for a transport company's own Trips — deliberately kept as
two separate features (a route groups multiple different customers' existing requests; a trip is a
company's own internal job list), just now with parity in what they can each represent.

`services/routes.ts` gained `updateRoute()`, `listOpsRouteStops()` (full-column, distinct from
`driver.ts`'s already-column-minimized `listRouteStops()`), `addRouteStop()`/`updateRouteStop()`/
`removeRouteStop()`, and `moveRouteStop()` (a low-tech up/down swap on `stop_order`, not a
drag-and-drop library). All plain table operations, no new RPC — `"ops staff manage routes"`/
`"ops staff manage route stops"` are already `ALL`-command RLS policies. UI lives entirely in
`operations/routes.$id.tsx`: a vehicle/driver picker plus a full stop list with an add/edit dialog
(type/city/country/planned time, and — for pickup/dropoff only, hidden for a plain rest stop —
animal/address/maps link/contact).

## Ops trips oversight (added 2026-09-14)

Transport-company Trips were only ever visible to that company's own members or a true
`is_admin()` — the broader `"operations"` role (everyone on the day-to-day ops dashboard) had zero
RLS access to any company's trip data. `20260923000000_ops_staff_manage_all_trips.sql` adds
`"ops staff manage all trips"`/`"ops staff manage all trip stops"` (`is_ops_staff()`, same pattern
as every other ops-wide policy in this domain) — deliberately scoped to `trips`/`trip_stops` only,
not `trip_join_requests` or the public-listing columns, so the company-facing join-request/public-
visibility workflow stays that company's own decision, not something ops reaches into.

Every function in `services/trips.ts` (`getTrip`, `listTripStops`, `updateTrip`, `setTripStatus`,
`addTripStop`/`updateTripStop`/`removeTripStop`, `markStopPickedUp`/`markStopDelivered`) is already
a plain RLS-scoped table call with no client-side org filter — so the new ops pages
(`operations/trips.tsx` list, `operations/trips.$id.tsx` detail) reuse them completely unchanged;
the only new function is `listOpsTrips()`, which joins `organisations(name)` since a single ops
list now spans many companies (`listMyTrips()` itself stays untouched/company-scoped).

## Related docs

- `docs/DOMAIN_MODEL.md` — the full transport data model (largest section in that doc), the
  two-trigger post-draft lock-down design, `transport_request_animals`/`transport_parties`
  hardening rationale.
- `docs/IMPLEMENTATION_PLAN.md` — cites the calendar view as a previously-flagged gap, now filled.
- `docs/adr/TRANSPORT_DATA_MODEL.md` — referenced from `docs/DOMAIN_MODEL.md` for the lock-down
  trigger design; not read directly in this pass.

## Last significant change

2026-09-14 (fifth pass): ops route field/status editing (route name, dates, destinations,
capacity, and a status dropdown, all on `routes.$id.tsx` — completing the "full custom route" CRUD
alongside the fourth pass's stop editor) plus full ops oversight of transport-company Trips (see
"Ops trips oversight" above). New migration: `20260923000000_ops_staff_manage_all_trips.sql`.

2026-09-14 (fourth pass): ops route planning — vehicle/driver assignment and a full stop editor
on `routes.$id.tsx` (see "Ops route planning" above). New migration:
`20260922000000_route_stops_planning_fields.sql`.

2026-09-14 (third pass): closed the account-linking loop (audit trail + notification + copyable
invite link — see "Driver account linking" above), added driver reputation + a computed SLA
"Overdue" badge, and added ops bulk actions + the driver-side two-way review (see the two sections
above). Three new migrations: `20260919000000_link_driver_account_rpc.sql`,
`20260920000000_transport_reviews_fleet_visibility.sql`, `20260921000000_driver_reviews.sql`.

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
