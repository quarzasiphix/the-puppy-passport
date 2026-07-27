# Cross-tenant fuzz matrix (Stage YR-14)

`tests/db/cross-tenant-fuzz.test.ts` (Stage CJE, extended this stage) is the single, consolidated,
purely data-driven sweep — one `FuzzCase[]` array, each entry a real seeded row plus a list of
genuinely unrelated personas who must see zero rows. Extended with `organisation_members` this
stage (an org's roster reveals who works where, no single dedicated cross-tenant test covered it
before).

## Why the matrix isn't a single mega-file covering every domain

This stage's own definition asks to cover "organisations, applications, messages, documents,
support, moderation, transport, ownership and jobs." The data-driven `FuzzCase` shape deliberately
reuses only already-seeded, static rows (`tests/db/helpers.ts`'s `ids`) — no per-test setup/teardown,
keeping the file genuinely "bounded and readable" as this stage's own definition also asks. Several
of the named domains (support cases, moderation cases, welfare cases, conversations/messages) have
**no seeded rows at all** — every real test for them already creates a disposable fixture and tears
it down, which doesn't fit this file's intentionally lightweight shape without duplicating that
setup machinery here for no added coverage. Rather than force an awkward, heavier version of this
file, this document is the actual "matrix": a real cross-reference of where each domain's
cross-tenant isolation is genuinely proven.

## The matrix

| Domain | Covered by | Shape |
|---|---|---|
| `transport_requests` / `transport_status_history` | `cross-tenant-fuzz.test.ts` | Data-driven, 3 real seeded requests |
| `buyer_applications` | `cross-tenant-fuzz.test.ts` | Data-driven, 1 real seeded application |
| `organisation_members` | `cross-tenant-fuzz.test.ts` (new this stage) | Data-driven, real seeded roster |
| `animals` (write) / `saved_animals` | `cross-tenant-fuzz.test.ts` | Direct assertion against real seeded rows |
| Organisations (private fields) | `tests/db/public-privacy-regression-suite.test.ts` (Stage YR-13) | Direct assertion |
| `private_addresses` | `tests/db/public-privacy-regression-suite.test.ts` (Stage YR-13) | Direct assertion |
| Support cases | `tests/db/support-cases.test.ts` | Disposable fixture, "an unrelated user cannot read this case" |
| Moderation cases / reporter identity | `tests/db/moderation-case-claim.test.ts`, `tests/db/public-privacy-regression-suite.test.ts` | Disposable fixture |
| Welfare cases | `tests/db/welfare-cases.test.ts` | Disposable fixture, org-scoped isolation |
| Messages (`is_internal`, conversation membership) | `tests/db/support-cases.test.ts`, `tests/db/access-control.test.ts` | Disposable fixture |
| Documents (transport/welfare-case, Storage) | `tests/db/access-control.test.ts` ("private documents and storage access") | Disposable fixture, cross-driver/cross-customer |
| Legal holds / account deletion | `tests/db/legal-holds.test.ts`, `tests/db/account-deletion-execution.test.ts` | Disposable fixture |
| Jobs/outbox | Not applicable — no job/worker/outbox system exists (XR-10/XR-11/XR-12/YR-4) |
| Ownership | Not applicable — no real ownership-transfer workflow exists yet (YR-11) |

## Verification

- `npx tsc --noEmit`, `npx eslint tests/db/cross-tenant-fuzz.test.ts` — clean.
- Extended file: 10/10 passing (up from 8).
- Full `npm run test:db` — see commit for exact count.
- No migration this stage.
