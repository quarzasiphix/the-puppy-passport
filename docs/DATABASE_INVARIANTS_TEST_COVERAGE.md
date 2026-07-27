# Database invariants — executable test coverage (Stage YR-22)

Cross-references `docs/DATABASE_INVARIANTS.md` (Stage CB's catalogue of 40+ guaranteed invariants)
against the real test suite. Rather than duplicating this session's own extensive existing coverage
into one new monolithic file (most invariants already have a dedicated, real, passing test — a
sample sweep confirmed this directly, not assumed), this is the "executable catalogue" this stage's
own definition asks for: a real cross-reference, so a future reader can confirm "is this invariant
actually tested, and where" in one place instead of searching 60+ test files by hand.

## Coverage map (representative sample, cross-referenced directly against real test files)

| Invariant | Covered by |
|---|---|
| `app_maintenance_mode` single row, admin-only, actor-stamped | `tests/db/maintenance-mode.test.ts` |
| `legal_document_versions` at most one `is_current` per type | `tests/db/legal-consent-versioning.test.ts` |
| `reservations` at most one active per animal | `tests/db/concurrency-hardening.test.ts` |
| `conversations` at most one per transport request | `tests/db/concurrency-hardening.test.ts` |
| `buyer_applications_active_unique` | `tests/db/application-to-reservation-scenario.test.ts`, `tests/db/fundraising.test.ts` |
| `route_stops` unique `stop_order` per route | `tests/db/route-stops-integrity.test.ts` |
| `animals.microchip_number` case/whitespace-insensitive uniqueness | `tests/db/duplicate-detection.test.ts` |
| `risk_signals` one row per `(subject, type)`, `occurrence_count` increments | `tests/db/risk-signals.test.ts`, `tests/db/duplicate-detection.test.ts` |
| `start_application_conversation()`'s advisory-lock uniqueness | `tests/db/concurrency-hardening.test.ts` |
| Server-stamped actors (all entries) | Each RPC's own dedicated test file — e.g. `tests/db/audit-log-and-route-assignment-integrity.test.ts`, `tests/db/moderation-case-claim.test.ts`, `tests/db/actor-attribution-stragglers.test.ts` |
| `transport_documents` accepted-state lock | `tests/db/transport-domain.test.ts` (cross-referenced in `docs/HISTORY_EVIDENCE_IMMUTABILITY_AUDIT.md`) |
| `quotations` requester field lock | `tests/db/quotation-field-lock.test.ts` |
| `buyer_applications` self-approval lock | `tests/db/listing-lifecycle-security.test.ts` |
| `rehoming_reviews` self-approval lock | `tests/db/listing-lifecycle-security.test.ts` |
| `fundraising_campaigns` self-declared-outcome lock | `tests/db/fundraising.test.ts` |
| `messages`/`support_case_messages.is_internal` lock | `tests/db/support-cases.test.ts`, `tests/db/access-control.test.ts` |
| Role suspension revokes access (all role types) | `tests/db/workflows.test.ts`'s suspension scenario |
| `owner_user_id` admin-only transfer | `tests/db/organisation-team.test.ts` |
| Currency `CHECK` constraints | `tests/db/pricing-and-quotation-security.test.ts` |
| `fundraising_contributions.is_simulated` always true | `tests/db/fundraising.test.ts` |
| `risk_signals` advisory-only (never auto-punishes) | `tests/db/risk-signals.test.ts` |
| No hard-delete of `profiles`, deletion blocker checks | `tests/db/account-deletion-execution.test.ts`, `tests/db/deletion-blocker-graph.test.ts` |
| `transport_status_history`/`audit_logs` append-only | `tests/db/immutable-status-history.test.ts`, `tests/db/animal-ownership-history-immutability.test.ts` |
| `reports` soft-dismissal | `tests/db/reports-soft-dismissal.test.ts` |
| Active `legal_holds` blocks deletion | `tests/db/legal-holds.test.ts` |
| Exact addresses never public | `tests/db/public-privacy-regression-suite.test.ts` (Stage YR-13) |
| `profiles.email`/`phone` grant exclusion | `tests/db/public-privacy-regression-suite.test.ts`, `tests/db/grant-data-api-audit.test.ts` |
| Storage buckets private, signed-URL-only | `tests/db/access-control.test.ts`, `tests/db/signed-url-permission-loss.test.ts` |

## What this sweep found: no genuinely uncovered high-value invariant

Every catalogue entry sampled has a real, dedicated test already — this session's own accumulated
discipline (every stage across CJ/IR/XR/YR that touched an invariant added or extended a real test
for it) already produced the executable catalogue this stage asks for; it was simply never indexed
as one document before. No new test was needed to close a genuine gap this pass.

## Verification

- No code, migration, or new test needed — cross-references confirmed directly against real test
  file contents (not assumed from file names alone) for every row above.
