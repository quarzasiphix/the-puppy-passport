# Transport operational timeline integrity (Stage YR-10)

## Already correct: the driver-side transition graph

`prevent_non_staff_operational_field_changes()` (Stage CC) already enforces a strict, real legal
transition graph for the assigned driver (`driver_assigned → pickup_confirmed → animal_collected →
in_transport → (rest_or_care_stop ↔) → approaching_destination → delivered → handover_confirmed →
completed`) — a driver cannot skip ahead, jump backward, or set an ops-only hold state. This
directly prevents "delivery before pickup" and duplicate/impossible driver-initiated events, and is
already covered by `tests/db/driver-status-state-machine.test.ts`'s chaos tests. Re-verified, not
re-built.

## The real, previously-unfulfilled gap: ops could reopen a terminal request with zero reason

`change_ops_request_status()` (Stage AD) deliberately places no restriction on which status ops
can move a request to — a real, correct design decision (Stage BF/CC both explicitly document ops
needing full override flexibility, since they need to correct mistakes or handle exceptions the
rigid driver graph shouldn't allow). But that flexibility was documented as needing to be paired
with an accountability half: the driver-status-state-machine migration's own comment promised
"that override path with an explicit reason + audit record is IR-8's dedicated scope." Traced
through `docs/AUTONOMOUS_BACKEND_PROGRESS.md`: IR-8 turned out to be about scheduling/capacity
conflicts (found already correct, no fix needed) — an unrelated topic. The reason-required
override path for reopening a terminal request was simply never built by any stage.

Fixed in `20260101013800_transport_terminal_reopen_reason.sql`: moving a request **out of** a
terminal status (`completed`, `rejected`, `cancelled_by_customer`, `cancelled_by_operations`) now
requires a real, non-blank `internal_note`. Every other transition — forward jumps, skips, and
moves between any two non-terminal statuses — remains completely unconstrained, preserving the
deliberate override flexibility already established. The ops UI
(`dashboard.operations.requests.$id.tsx`) already has a real internal-note textarea for exactly
this purpose, so no frontend change was needed — ops can already satisfy the new requirement
through the existing form.

## Other named concerns, checked

- **Route/stop ordering**: `route_stops (route_id, stop_order)` already has a real unique
  constraint (Stage BF) — two stops on the same route can never silently share an order.
- **Evidence/incident/amendment timelines**: these each have their own narrower, already-reviewed
  workflows (`review_transport_amendment()`'s terminal-state guard, `transport_status_history`'s
  own immutability from Stage XR-6) — no additional cross-cutting timeline-ordering concern found
  specific to this stage's scope beyond the one fixed above.
- **"Preserve override reason and audit where operations override is legitimate"**: now genuinely
  true for the highest-risk case (terminal reopening); every status change already writes a real
  `audit_logs` entry (Stage AD, unchanged).

## Verification

- `npx tsc --noEmit`, `npx eslint tests/db/change-ops-request-status.test.ts` — clean.
- New tests in `tests/db/change-ops-request-status.test.ts`: reopening a completed request with no
  reason is rejected, a whitespace-only reason is treated the same as no reason, a real reason
  succeeds, and ordinary non-terminal transitions remain completely unconstrained (no reason
  required) — 12/12 passing in the file.
- Full `npm run test:db`: **989/989** (+7 from YR-9's 982), verified on a fresh reset plus one more
  run without reset.
- `npm run build`, `npm run db:preflight` (140 migrations, no unsafe patterns), `npm run
  db:contract-check` (no drift — signature unchanged, only the function body) — all clean. No
  duplicate migration prefixes.
