# Support-to-operations boundary audit (Stage YR-6)

## The real role model: one combined staff tier, not two

This stage's own definition asks to audit "support tools for accidental access to moderation,
ownership, financial or transport operations mutations" — implying two distinct roles (support vs.
operations) that need a boundary between them. Checked against this app's real role model: **no
separate "support" role exists**. `is_ops_staff()` (`has_role(auth.uid(), 'operations') or
is_admin()`) is the single gate for both support-case management and every transport/operations
RPC this session has built or audited (`change_ops_request_status()`, `assign_driver_to_job()`,
`send_quotation()`, etc.) — a deliberate choice the original support-cases migration's own comment
already states: "no dedicated 'support' platform_role exists... ops staff are the closest real,
already-trusted staff concept." There is no lower-trust "support-only" actor in this app today that
could accidentally reach into operations mutations beyond what they're already legitimately allowed
to do as ops staff — the premise of a boundary being crossed doesn't apply, because there's no
separate side to cross from.

The one staff/staff boundary that *does* genuinely exist and matters is **ops staff vs.
moderator** — two independently checked gates (`is_ops_staff()` vs. `is_moderator()`). New test
proves this directly: the seeded `ops` persona (role `operations` only, no `moderator` role) is
correctly rejected by `claim_moderation_case()`.

## "Support case relations are context only, not capabilities" — confirmed structurally and directly

`support_cases.related_entity_type`/`related_entity_id` are documented in the original migration
as "never trusted for authorisation... context for staff, not a capability." Confirmed by grep:
**zero** policies, RPCs, or query helpers anywhere in the schema or app code reference these two
columns for anything beyond storing them. New test proves this directly rather than trusting the
absence of code alone: a customer's support case can reference a transport request belonging to a
different user with no effect whatsoever — the customer still cannot read that foreign transport
request through any path, the relation column grants nothing.

## "Prevent support staff from changing protected operational fields" / "audit read access and internal-note privacy"

Already correctly enforced and already tested (pre-existing coverage in
`tests/db/support-cases.test.ts`, re-verified, not duplicated): a customer cannot set
`priority`/`assigned_staff_id`/`status` beyond the one legitimate self-service reopen transition,
cannot smuggle a staff-only field change into a reopen call, and `is_internal` messages are locked
at the RLS layer exactly like `messages.is_internal` (Stage R) — a customer can never post or read
one.

## Verification

- `npx tsc --noEmit` — clean (no code change, test-only stage).
- `npx eslint tests/db/support-cases.test.ts` — clean.
- 2 new tests, 38/38 passing in the file overall (up from 36).
- No migration this stage.
