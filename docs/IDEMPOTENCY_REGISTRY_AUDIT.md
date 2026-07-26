# Idempotency key registry audit

Stage XR-9 (append-only queue). Audited for genuine retry-safety across every write path where a
client that never learned whether its first call succeeded (a dropped response, a timeout, a
double-click before a button disables) might retry the exact same call.

## No new generic key table built — a deliberate scope decision, not an oversight

This schema already has several well-fitted, narrower idempotency mechanisms rather than one
generic actor/tenant/operation-scoped key table:

- `buyer_applications_active_unique` — a real partial unique index, since "at most one active
  application per buyer per animal" is a hard business rule, not merely retry-safety.
- `create_notification_if_enabled()`'s `dedup_key` column (Stage CJR).
- `reservations`/route-assignment/conversation-creation unique indexes (Stage
  concurrency_hardening).
- `claim_moderation_case()`/`claim_support_case()`'s own "idempotent if it's already you"
  re-claim handling.

A new, generic key-registry table has no currently-demonstrated real consumer beyond what these
targeted mechanisms already cover — building one now would be exactly the speculative
infrastructure this session has repeatedly and correctly declined to build elsewhere (Stages
BA/BB/BE/BP/BS).

## Found and fixed: 2 "convert once" RPCs weren't actually idempotent on retry

`convert_application_to_reservation()` and `convert_welfare_case_to_transport_draft()` both
already correctly prevented a *second, real* conversion — but did it by raising an exception on
retry rather than returning the original success, exactly the gap this stage's own definition
names ("reject same key with changed payload... return original success"). A client retrying after
a dropped response (the operation actually succeeded the first time) saw an error, not the
reservation/transport request it already has.

Fixed in `20260101013200_conversion_rpc_idempotent_retry.sql`:

- **`convert_welfare_case_to_transport_draft()`**: a retry (same case, no separate payload —
  everything is derived from the case's own columns) now returns the existing
  `converted_transport_request_id` instead of a confusing "not yet accepted" error against a
  status that only changed because the first call already succeeded.
- **`convert_application_to_reservation()`**: a retry with the *exact same* terms
  (price/currency/date/collection-method) returns the original reservation's id. A retry with
  *different* terms is correctly rejected as a real conflict, not silently accepted or silently
  ignored — proven directly: the pre-existing test's own retry call (which omits
  `p_agreed_price`/`p_currency`, defaulting to values different from what was actually recorded)
  already exercised this exact "changed payload" path and still passes.

## Found and fixed: a genuine, if narrow, concurrency race in the same RPC

Writing a "10 genuinely concurrent identical calls" test (`Promise.all`, matching the pattern
already proven for `create_notification_if_enabled()`/`review_welfare_case()`) surfaced a real gap
`convert_application_to_reservation()`'s initial fix didn't cover: two callers can both pass the
"does a reservation already exist" check before either commits (standard `READ COMMITTED`
behaviour), then race at the `INSERT` — `reservations_application_id_key`'s real, pre-existing
unique constraint means only one can ever actually succeed, but the *other* caller would have hit a
raw, confusing unique-violation Postgres error instead of the same idempotent success the
sequential-retry path already provides. Closed by wrapping the insert in an `exception when
unique_violation` handler that resolves exactly like `create_notification_if_enabled()`'s own
insert-or-return-existing race handling. Verified across 3 consecutive fresh-reset test runs, not
just once, given the inherent timing-dependence of proving a race is actually closed.
