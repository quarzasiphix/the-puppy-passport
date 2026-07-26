# Immutable history/evidence preservation audit

Stage XR-6 (append-only queue). Audited every status/ownership/audit/document/moderation/support
history-shaped table in this schema for a real UPDATE/DELETE policy — the "can staff quietly
rewrite or destroy the historical record" bug class.

## Already confirmed fully append-only (no fix needed)

- **`transport_status_history`**: SELECT/INSERT only, zero UPDATE/DELETE policy for anyone.
- **`audit_logs`**: SELECT/INSERT only — re-confirmed at Stage XR-3 directly against a live admin
  session (the broad table-level grant is inert, RLS is the real, airtight gate).

## Fixed this stage

- **`animal_ownership_history`**: only policy was `for all` for admins — full CRUD on a table its
  own comment already describes as provenance/history data. Split to admin-`SELECT`-only, with no
  `INSERT` granted to anyone (this table has zero real writer anywhere in `src/`, confirmed by grep
  — Stage Y's original finding, still true). `20260101012900_history_evidence_immutability.sql`.
  New `tests/db/animal-ownership-history-immutability.test.ts` proves no role can insert a row via
  the Data API today (the strongest form of "no ordinary write access," since a row that can never
  be created can also never be updated/deleted through the API) and that admin `SELECT` still works
  correctly (an empty result, not a 403).

## Checked and deliberately left unchanged

- **`reports`**: superficially the same shape (a `for all` admin/moderator policy), but
  `tests/db/reports-soft-dismissal.test.ts`'s own header comment makes the real decision explicit:
  Stage CJG already considered removing raw `DELETE` capability and chose to keep it intentionally
  ("a report could legitimately need real removal in a rare case, e.g. defamatory content"). A
  real, considered, already-tested design decision — not an overlooked gap. **Caught before
  committing a wrong fix**: an earlier draft of this stage read only the migration file's own
  comment (which focuses on the normal-path `dismissReport()` fix) and concluded the RLS layer had
  been left half-done; re-reading the paired test file's fuller explanation before applying the
  change showed that conclusion was wrong, and the draft was corrected before the migration was
  finalized.
- **`moderation_cases`, `moderation_appeals`, `messages`, `support_cases`, `support_case_messages`**:
  all use a similar staff `for all` shape, but each is a *current-state* record with a real
  lifecycle (status transitions, active investigation, ongoing conversation), not a pure append-only
  log — unlike `animal_ownership_history`, there is a plausible legitimate need for staff to
  correct or remove a genuinely problematic row (e.g. illegal content in a message) and no
  documented prior intent (the way `reports` has) establishing that DELETE should be removed. Not
  touched without stronger, specific evidence — tightening five separate tables' RLS on a guess
  would be exactly the kind of speculative, unrequested-scope change this session's own standing
  rules avoid.

## What this stage did not do

Did not rewrite `reports`' RLS (a deliberate design decision, confirmed by test-file evidence, not
a gap). Did not touch `moderation_cases`/`moderation_appeals`/`messages`/`support_cases`/
`support_case_messages` — flagged here as the honest boundary of this audit's confidence, not
silently ignored.
