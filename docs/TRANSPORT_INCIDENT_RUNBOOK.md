# Transport incident runbook

Real, tested mechanisms — `dashboard.operations.incidents.tsx` (ops view),
`report-incident-dialog.tsx` (driver-facing report form), `transport_incidents` table.

## Real incident types (from the actual schema, not invented)

`delay`, `vehicle_breakdown`, `animal_welfare_concern`, `accident`, `document_issue`, `weather`,
`other` — each with a real severity (`low`/`medium`/`high`/`critical`).

## Who can report

`reportIncident()` — `reported_by` is RLS-enforced against the real caller
(`with check (reported_by = auth.uid())`), not client-trusted (confirmed already-correct at this
session's own earlier Stage BH audit — no forgeable-actor gap here). Only the driver assigned to
that specific request can report on it (`is_assigned_driver_for_request()`, itself fixed at Stage
BD to correctly check the driver's _active_ role status, not just their profile id).

## Who can resolve

Ops-only — drivers have no UPDATE policy on their own incident report at all (can't edit or
retract after filing, preserving report integrity).

## Real scenarios mapped to real fields

- **Delay**: `incident_type: 'delay'`, severity usually `low`/`medium` unless it cascades into a
  missed handover window.
- **Failed pickup / unreachable party**: not a distinct enum value — file as `other` with a clear
  `description`, since the schema doesn't have a dedicated type for this yet (a real, small,
  future schema addition if this becomes a common enough pattern to warrant its own type).
- **Missing documents**: `document_issue`.
- **Animal welfare concern**: `animal_welfare_concern` — treat as `high`/`critical` by default;
  this is the one category most likely to need immediate ops attention regardless of what the
  driver's own severity guess was.
- **Accident**: `accident`, always `high`/`critical`.
- **Weather**: `weather`.

## Evidence

Incident reports are text-only in the current schema (`description`) — the _separate_
pickup/delivery evidence mechanism (`transport-evidence` Storage bucket, wired to
`advance_transport_job_status()`) is not currently linked to `transport_incidents` rows. A driver
filing an incident today cannot attach a photo to that specific incident record — they'd need to
separately advance the job status with evidence, or describe the issue in text. Flagged as a real,
small future improvement (link an optional evidence path to `transport_incidents`), not built here
speculatively without a demonstrated need for it yet.

## Escalation

No automatic escalation/paging exists — ops staff monitoring `dashboard.operations.incidents.tsx`
is the real, current mechanism. For `critical` severity, this runbook recommends immediate manual
outreach to the assigned ops contact rather than relying on the dashboard being watched
continuously, since no alerting system exists to guarantee that.
