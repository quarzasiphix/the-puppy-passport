# Optimistic concurrency / stale-write protection audit

Stage XR-8 (append-only queue). Audited every RPC/table that decides a shared case or record's
outcome for a real "two concurrent callers" race, and for a guard against re-deciding something
already in a genuinely terminal state.

## Already correctly protected (no fix needed)

- **`claim_moderation_case()`**, **`claim_support_case()`**: both already use `select ... for
  update` plus a clear "already claimed by someone else" rejection (Stage BM).
- **`review_moderation_appeal()`**: already checks the appeal's current status
  (`submitted`/`under_review` only) before allowing a decision, rejecting a re-review of an
  already-resolved appeal.
- **Driver status transitions** (`advance_transport_job_status()`): the whole point of Stage CC's
  state machine — already chaos-tested with genuinely parallel `Promise.all` calls proving no
  invalid transition sneaks through regardless of ordering.
- **`reservations`**/**conversation creation**: unique constraints and advisory locks close the
  "two concurrent callers create a duplicate" race (Stage concurrency_hardening).
- **Quotation pricing edits**: audited and found not reachable at all — there is no real UI/query
  function that edits an *existing* quotation's price fields after creation (only `insert` and the
  `sendQuotation()` status transition exist), so there's no real "two staff editing the same
  quotation simultaneously" path to protect.
- **Moderation case resolution by a non-assignee moderator**: superficially similar shape, but
  `20260101010300_moderation_case_claim_rpc.sql`'s own comment makes this a **deliberate, already-
  considered design decision**, not an oversight: "Broader moderation actions (resolving a case,
  reassigning between moderators, adding decision notes) keep using the existing 'is_moderator()
  manages all cases' policy directly — this isn't touched, since a reassignment override is a
  legitimate admin action this stage found no evidence needs restricting further." **Caught before
  attempting a fix**: an early read of this area looked like a real gap (any moderator can resolve
  a case someone else claimed, bypassing the claim mechanism) until this comment was found — the
  same "read the full prior context before concluding a gap exists" lesson this session has
  learned more than once (most recently at Stage XR-6's `reports` near-miss).

## Fixed this stage: `review_welfare_case()`

The one real, previously-unprotected gap: `review_welfare_case()` (`20260101007600_welfare_cases.sql`)
did a plain, unlocked `update ... where id = p_case_id` with **no read of the current row first**
— unlike every sibling claim/decision RPC above. Two concrete, real risks:

1. **Race**: two ops staff (or the same one, two browser tabs) concurrently reviewing the same
   case with different decisions — whichever `UPDATE` commits last silently wins, with no
   serialization and no audit trace that a conflict ever happened (both `audit_logs` entries
   recorded `before: null`, since neither read the actual prior state).
2. **No terminal-state guard**: a case already `converted_to_transport` (a real `transport_requests`
   row already exists, created by `convert_welfare_case_to_transport_draft()`) or `closed` could
   still be silently re-reviewed and reset back to `declined`/`accepted_for_assessment`, leaving the
   welfare case's own status directly contradicting the real transport request it already spawned.

Fixed with `20260101013100_welfare_case_review_concurrency_lock.sql`: `select ... for update`
(the same row-lock shape every sibling RPC already uses) plus an explicit rejection for the two
genuinely terminal states, matching `submit_moderation_appeal()`'s existing "already resolved"
precedent. Reconsidering between `accepted_for_assessment`/`declined`/`information_required`
remains fully allowed — a real, legitimate ops workflow (new information arrives, a decision is
revisited) this fix must not and does not restrict. Also improved the `audit_logs` entry's
`before` value from an always-`null` placeholder to the real prior status, a free byproduct of now
reading the current row anyway.

New tests in `tests/db/welfare-cases.test.ts` prove: reviewing an already-converted case is
rejected and the row survives untouched; reconsideration between the three non-terminal states
still works; and 10 genuinely concurrent (`Promise.all`) review calls on the same non-terminal case
all serialize safely to exactly one real, consistent final state.
