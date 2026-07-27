# Schema naming and ownership consistency (Stage YR-21)

## Overall naming convention: consistent, no systemic problem found

Checked all 70 enum types, table names, and the 41 public RPCs for a systemic naming problem.
The schema is overwhelmingly consistent: enums are domain-prefixed (`transport_status`,
`moderation_case_status`, `welfare_case_status`), tables are plural nouns, RPCs follow
`<verb>_<entity>` or `<entity>_<verb>` consistently within each domain (`claim_moderation_case`/
`claim_support_case`, `approve_rehoming_review`/`approve_user_verification`). No systemic
inconsistency found worth a broad fix.

## The one real, genuine naming ambiguity found: the "verification" cluster

Five distinct enum types all relate to "verification," and one of them has no domain prefix at
all, making it easy to confuse with the other four at a glance:

| Enum type | Values | Actually governs |
|---|---|---|
| `verification_status` | `not_started`, `pending`, `approved`, `rejected` (unprefixed — the ambiguous one) | `user_verifications.status` — the review status of a breeder/organisation/driver/transport-employee's own submitted verification application |
| `verification_type` | `breeder`, `organisation`, `driver`, `transport_employee` | `user_verifications.verification_type` — *what kind* of verification is being submitted (the companion column to the above) |
| `org_verification_status` | `pending`, `approved`, `rejected`, `suspended` | `organisations.verification_status` — the resulting trust state of the organisation itself, once `user_verifications` has been approved (a different table, a different lifecycle, includes `suspended` which `verification_status` doesn't) |
| `driver_verification_status` | `unverified`, `documents_submitted`, `verified` | `drivers.internal_verification_status` — the driver record's own document-review state, distinct from *both* of the above |
| `achievement_verification_status` | `pending`, `approved`, `rejected` | `achievements.verification_status` — an unrelated concept (a breeder's claimed award/title), reusing the same 3-value shape by coincidence, not by relation |

**Why this wasn't renamed**: `verification_status` is a real, live, tested column type
(`user_verifications.status`), referenced by `approve_user_verification()` and this session's own
new audit-trail work (Stage YR-7) — a genuine "stable public contract" this stage's own instruction
explicitly says not to rename without a dedicated migration and compatibility plan. This document
is the safe alternative: resolving the ambiguity for a future reader without touching anything
live. A future dedicated rename pass (e.g. `verification_status` → `user_verification_review_status`)
would be a reasonable, low-priority cleanup candidate, not urgent — flagged here for whoever
eventually does it, not attempted now.

## Duplicate-concept check: `status` columns across the schema

Grepped for a genuinely dangerous form of ambiguity — the same *table* having two differently-named
columns that both mean "status," which would be a real ownership/source-of-truth problem, not just
a naming quibble. Found none: every table with a lifecycle has exactly one `status` (or precisely-
named, e.g. `admin_status`, `internal_verification_status`) column, never two competing ones.

## Verification

- No code, migration, or test change this stage — a genuine documentation-only deliverable per its
  own explicit "do not rename stable public contracts" instruction. Every claim above checked
  against the live `pg_type` catalogue, not assumed from memory.
