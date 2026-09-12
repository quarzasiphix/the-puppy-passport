# Operations domain

Internal ops/admin platform-settings surface: transport-request operations queries, maintenance
mode, and geographic-market enablement. All ops-only per CLAUDE.md's UX principle ("internal
dashboards can and should stay precise and technical") — this domain is not expected to be
translated (see the `dashboard/admin`/`dashboard/operations` translation exclusion in the repo-root
`TODO.md`).

## What this owns

- `transport_requests`, `transport_status_history`, `transport_documents`, `transport_parties`,
  `transport_request_animals`, `transport_request_amendments`, `quotations` (ops-side reads/
  writes) — `listOpsTransportRequests`, `getOpsKpiCounts`, `getOpsRequestDetail`,
  `listOpsStatusHistory`, `listOpsDocuments`, `changeOpsRequestStatus`, `listOpsQuotations`,
  `listRequestsNeedingQuotation`, `createQuotation`, `sendQuotation`, `listOpsTransportParties`,
  `listOpsTransportAnimals` (`services/operations.ts`, 339 lines). "Protected by RLS
  (`public.is_ops_staff()`) on every table touched here, not by anything in this file. A customer
  or breeder calling these gets an empty/error result from Postgres regardless of what the UI does"
  (`services/operations.ts:1-3`).
- `app_maintenance_mode` — `getMaintenanceMode`/`setMaintenanceMode` (`services/maintenance.ts`).
  Single always-exactly-one-row settings table; `src/server.ts`'s Worker fetch handler reads it
  directly (cached briefly) to decide whether to serve the real app or a maintenance page — this
  file is only the admin-facing read/write side.
- `markets` — `listMarketsForAdmin`/`setMarketEnabled` (`services/markets.ts`). Notable history:
  "schema-only — real, RLS-correct, seeded... but confirmed by `grep`... to have zero UI anywhere.
  'admins manage all markets' RLS already existed; only the admin page was missing" (`:1-3`) — the
  same "policy existed, UI was the only gap" pattern seen in `identity/services/organisations.ts`.

## File structure

- `index.ts` — re-exports `services/maintenance`, `services/markets`, `services/operations`.
- `services/maintenance.ts` (28 lines) — maintenance-mode toggle, described above.
- `services/markets.ts` (25 lines) — market enable/disable, described above.
- `services/operations.ts` (339 lines) — the bulk of the domain, transport-ops queries described
  above.

## Public API

`index.ts` exports the full surface flatly.

## Known gaps

None found as of 2026-09-12 — no in-code "not built"/"not applied" markers were found in this
domain during this pass.

## Related docs

- `docs/DOMAIN_MODEL.md` — the transport module (the largest module in the schema), routes/fleet,
  and the `markets` table's per-feature `market_state` design.

## Last significant change

Not determined from in-domain evidence in this pass; file created 2026-09-12 as part of the
project-wide `AGENTS.md` rollout.
