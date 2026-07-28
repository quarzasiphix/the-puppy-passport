# Test-suite hygiene fix + a real draft-delete bug it uncovered

Triggered directly by the user's own request to check everything works and finalise unfinished
items: running `npm run release:preflight -- --with-db` a third consecutive time without an
intervening `db:reset` exposed real, previously-latent data pollution.

## Bug 1: silently swallowed cleanup-delete errors let stray rows survive between test runs

`tests/db/adoption-questionnaire.test.ts` had three `test()` blocks, each inserting a
`buyer_applications` row and cleaning it up in an unawaited-for-errors `await ...delete()` call.
None of the three checked `.error`. Worse, none of the three wrapped their subtest sequence in
`try`/`finally` — `node:test` does not automatically continue to a later `await t.test(...)` once
an earlier one throws (an assertion failure throws), so if any assertion *before* the cleanup
subtest failed, cleanup never ran at all, not just failed silently.

**Confirmed genuinely reachable, not hypothetical**: a real stray `buyer_applications` row
survived a fresh `db:reset` plus two clean `npm run test:db` passes, then broke
`security-regressions.test.ts`'s "an unrelated org cannot notify the same applicant" assertion on
a third consecutive run. Isolated `access-control.test.ts` still passed 47/47 on its own, proving
this was genuine bad data, not ordinary cross-file pollution within one run.

**Fix**: wrapped each test's subtest sequence in `try { ... } finally { await t.test("cleanup", ...) }`
(the same pattern `fundraising.test.ts`'s `buildEligibleFixture()` already requires in its own
comment) and added `assert.equal(deleted.error, null, ...)` to every cleanup delete, so a real
failure is now loud instead of silent.

## Bug 2 (found while fixing bug 1): "delete your own draft request" was completely broken

Adding the `.error` check on `adoption-questionnaire.test.ts`'s transport-request cleanup exposed
a second, independent, real bug: the delete failed every time with `prevent_animal_and_party_
changes_after_draft()`'s "can no longer be edited directly once it has left draft" exception —
even though the request was still in `draft`.

**Root cause**: that trigger (`20260101007000_transport_animal_and_party_lock_after_draft.sql`)
fires on `transport_request_animals`/`transport_parties` and looks up the parent
`transport_requests` row's current status. When a requester deletes their own draft request
(`"requesters delete their own draft requests"`, `20260101002400_animals_transport_fields.sql`),
Postgres deletes the parent row first, then — same transaction — `ON DELETE CASCADE` reaches the
child rows. By then the parent row is gone, so the trigger's status lookup finds nothing,
`v_status` is `null`, and `null is distinct from 'draft'` evaluates `true` — so the trigger always
rejected the cascade, regardless of the request's real status at the moment of deletion.

This means the documented "requesters delete their own draft requests" feature has never actually
worked for any draft with animals or parties attached — which is the normal case, since
`create_transport_draft()` always inserts both. It only silently "worked" for the artificial case
of an empty draft with zero animals/parties, and even that only appeared to work because no test
ever checked the delete's own error.

**Fix** (`20260101014100_draft_delete_cascade_lock_fix.sql`): a direct insert/update/delete on a
child row can never observe a missing parent (the foreign key requires it to exist), so "this is a
`DELETE` and the parent is now missing" can only mean the call arrived via cascade from the
parent's own deletion — which itself could only have succeeded while `status = 'draft'`, per that
row's own RLS policy. Allow that specific case; every other case (direct child-row edits while the
parent still exists) is unchanged.

## New tests

- `tests/db/transport-domain.test.ts`: `"a requester can delete their own draft request even with
  animals and parties attached"` (proves the fix) and `"a requester still cannot delete their own
  request once it has left draft"` (proves the existing restriction still holds).
- `tests/db/adoption-questionnaire.test.ts`: no new test added (existing coverage already exercises
  this path); its own cleanup step is now itself a live regression check for this exact bug, since
  it deletes a request created via `create_transport_draft()` with animals+parties.

## Verification

- `npx prettier --write` + `npx eslint` on both changed test files — clean.
- `node --test tests/db/adoption-questionnaire.test.ts` in isolation — passing.
- Fresh `npm run db:reset`, then `npm run test:db` **three consecutive times without an
  intervening reset** (matching the exact condition that originally exposed the bug) —
  **1015/1015** every time (+2 from the previous 1013 baseline).
- `npx tsc --noEmit` — clean.
- `npm run build` — succeeds.
- `npm run db:preflight` — 143 migrations, no unsafe patterns.
- `npm run db:contract-check` — no drift (70 tables, 41 RPCs match baseline; this migration only
  redefines an existing trigger function's body, no signature/grant change).
- No duplicate migration prefixes. `git status --short` shows only the intended changed files.
