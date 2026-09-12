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
- `routes`, `route_stops`, `route_assignments`, `route_waitlist`, `vehicles` —
  `services/routes.ts` (231 lines, 15 exports) and `services/fleet.ts` (46 lines, 8 exports).
  Assignment goes through `assign_request_to_route`/`assign_driver_to_job` RPCs.
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

- `index.ts` — re-exports all 9 service files and all 5 components (`ops-request-table`,
  `report-incident-dialog`, `review-transport-dialog`, `transport-document-checklist`,
  `transport-timeline`).
- Services: `calendar.ts`, `dispatch.ts`, `driver.ts`, `fleet.ts`, `matching.ts`, `pricing.ts`,
  `routes.ts`, `transport.ts`, `welfare.ts` — described above.
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

## Related docs

- `docs/DOMAIN_MODEL.md` — the full transport data model (largest section in that doc), the
  two-trigger post-draft lock-down design, `transport_request_animals`/`transport_parties`
  hardening rationale.
- `docs/IMPLEMENTATION_PLAN.md` — cites the calendar view as a previously-flagged gap, now filled.
- `docs/adr/TRANSPORT_DATA_MODEL.md` — referenced from `docs/DOMAIN_MODEL.md` for the lock-down
  trigger design; not read directly in this pass.

## Last significant change

Not determined from in-domain evidence in this pass; file created 2026-09-12 as part of the
project-wide `AGENTS.md` rollout.
