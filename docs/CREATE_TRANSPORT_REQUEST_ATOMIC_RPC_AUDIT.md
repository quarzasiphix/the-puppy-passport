# createTransportRequest atomic-RPC conversion

The last remaining item from `docs/TRANSACTIONAL_WORKFLOW_BOUNDARIES_AUDIT.md`'s original list of
6 multi-write client functions, deliberately deferred at the time ("its payload is a large,
evolving multi-field form, not a good RPC-signature fit right now"). Its actor-forgery half was
already closed (`stamp_changed_by_actor()`, Stage XR-7); only the atomicity gap remained open.

## The known gap going in

`createTransportRequest()` (`src/lib/queries/transport.ts`) did a plain `.insert()` into
`transport_requests`, then a separate `.insert()` into `transport_status_history`. If the second
write failed, a live request row was left with no initial history entry.

## A second, more severe bug found while investigating the real fix

The public standalone transport-request form (`_public.transport.request.tsx`) auto-saves a draft
via `saveDraft()` before the user ever submits — a real row with a real `id`. On final submission,
`buildTransportRequestPayload(..., "submitted", draftId, ...)` includes that same `id` in the
payload, and the old `createTransportRequest()` did a plain `.insert(payload)` — attempting to
insert a **second** row with an `id` that already belongs to the still-existing draft row.

**Confirmed empirically against the live database, not assumed**: this always failed with
`23505 duplicate key value violates unique constraint "transport_requests_pkey"`. Submitting any
previously-saved draft was completely broken — a real, reachable, previously-undocumented bug in a
commercially critical, customer-facing flow (draft-save-and-resume is an explicit UX requirement
in this project's own CLAUDE.md).

## The fix

New migration `20260101014400_submit_transport_request_atomic_rpc.sql`: `submit_transport_request
(p_request jsonb, p_draft_id uuid default null)`, a single `SECURITY DEFINER` RPC that:

- When `p_draft_id` is given: `UPDATE`s the existing draft row in place (transitioning
  `draft -> submitted`) instead of attempting a second insert. Fields absent from `p_request`
  `coalesce` to the row's existing stored value rather than nulling them out — correct for a
  partial or repeated call, and required for NOT NULL columns.
- Otherwise: `INSERT`s a fresh row, matching the previous no-draft behavior.
- Both branches write the initial `transport_status_history` row in the same transaction — the
  original atomicity gap.
- `requester_profile_id` is always `auth.uid()`, never taken from the payload — a forged value in
  `p_request` is silently ignored, proven by a dedicated test.

**Confirmed safe against existing triggers by reading their live definitions before writing this
function, not assumed**: `prevent_customer_snapshot_changes_after_submission()` unconditionally
exempts `old.status = 'draft'`, and `prevent_non_staff_operational_field_changes()` explicitly
allows the `old.status = 'draft' and new.status = 'submitted'` transition for a non-staff caller —
both were already correctly designed for exactly this transition.

Deliberately does **not** touch `create_transport_draft()`/the `transport_request_animals`/
`transport_parties` normalized flow — the standalone public form only ever writes the inline
legacy columns on `transport_requests` directly, matching its current real behavior exactly.
Unifying the two flows is a separate, larger, out-of-scope refactor.

Two real bugs found while testing the new RPC itself, fixed before this migration's first commit
(never committed in a broken state): an ambiguous `id`/`request_number`/`status` column reference
in the INSERT branch's `RETURNING` clause (colliding with the function's own `RETURNS TABLE` output
column names — fixed by qualifying with `transport_requests.`), and the UPDATE branch nulling out
NOT NULL columns absent from a given payload instead of preserving the existing value.

## Client changes

- `src/lib/queries/transport.ts`: `createTransportRequest()` now calls the RPC instead of two raw
  writes; external signature unchanged (same `TransportRequestInsert` input, same
  `{id, request_number, status}` output shape) so its one call site needed no logic changes beyond
  removing now-dead cleanup code.
- `src/routes/_public.transport.request.tsx`: removed the manual "delete the old draft row after a
  successful create" step — no longer needed, since the RPC updates the draft row in place.
- `src/lib/supabase/types.ts` regenerated via `npm run db:types` (never hand-edited).

## Tests

Five new tests in `tests/db/transport-domain.test.ts`: fresh submission (atomicity), submitting a
saved draft (the core bug — proves exactly one row exists afterward, never a duplicate-key error),
cannot submit another user's draft, cannot re-submit an already-submitted request, and a forged
`requester_profile_id` in the payload is ignored.

## Verification

- `npx prettier --write` + `npx eslint` on all changed TS/TSX files — clean (one pre-existing,
  unrelated `react-hooks/exhaustive-deps` warning in the route file, confirmed via `git stash`
  before this change).
- `node --test tests/db/transport-domain.test.ts` in isolation — 51/51 passing.
- Fresh `npm run db:reset`, then `npm run test:db` twice — **1034/1034** both times (+5 from 1029).
- `npx tsc --noEmit` — clean.
- `npm run build` — succeeds.
- `npm run db:preflight` — 146 migrations, no unsafe patterns.
- `npm run db:contract-check` — baseline deliberately regenerated for the new RPC (70 tables, 43
  RPCs), no unreviewed drift.
- No duplicate migration prefixes. `git status --short` shows only the intended changed files.
