# Pilot offboarding

Real, verified capabilities only — every mechanism named below already exists and is tested.

## Removing a team member

`removeOrgMember()` (`remove_org_member` RPC) or suspending via `set_org_member_status` — both
real, atomic, actor-audited operations already in `dashboard.*.team.tsx`. A removed/suspended
member's access to the organisation's cases, applications, and messages is revoked immediately
(RLS re-evaluates on every request; this session's own work this pass confirmed no stale-access
gap in the areas touched this session).

## Suspending an organisation

Admin-only (`organisations.verification_status = 'suspended'`) — immediately removes the org's
listings from every public view (verified, not assumed: `docs/AUTONOMOUS_BACKEND_PROGRESS.md`'s
Stage YR-8 entry). Existing applications/reservations tied to the org remain visible and
withdrawable to the buyer who made them; only _new_ applications against a suspended org are
blocked.

## Exporting a pilot's data before offboarding

`exportMyData()` (`src/lib/queries/privacy.ts`) — a real, working self-service export covering
profile, roles, transport requests, reservations, applications, saved animals, posts, sent
messages, and notifications, versioned with a schema manifest. An organisation's own listings
(animals, litters) remain queryable by the org's own dashboard for as long as the org isn't
deleted, independent of this export.

## Account deletion

`requestAccountDeletion()` → admin-reviewed `execute_account_deletion()` — real anonymisation
(not a hard delete; history/audit-trail rows survive with the actor's identity cleared), blocked
while a real unresolved obligation exists (active transport request, reservation, application, or
unresolved organisation ownership) or an active legal hold — all genuinely enforced, not just
documented (`docs/HIGH_FINDING_CLOSEOUT.md`'s HF-1 entry closed the one real gap found in this
exact path this session).

## Legal holds

Admin-only `place_legal_hold()`/`release_legal_hold()` — blocks account deletion and (as of this
session's HF-1/FA-4 work) self-service deletion of the held profile's own comments and buyer
applications. Scope is specifically account-deletion-and-adjacent-self-delete protection, not a
general litigation/evidence hold across every table — worth being precise about this scope with
legal counsel before using the term "legal hold" in any real communication, since the plain-English
term implies broader protection than what's actually implemented (a real nuance an independent
audit pass flagged this session, not invented here).

## Retained shared history after offboarding

Transport status history, audit logs, and `animal_ownership_history` are append-only by design —
offboarding a party never deletes their name from a transaction another real party (buyer, other
org, ops) has a legitimate ongoing record of. This is deliberate, not an oversight: the same
"anonymise, don't cascade-delete" principle `execute_account_deletion()` itself follows.

## What isn't built yet

There's no dedicated "offboarding wizard" UI — offboarding today is a set of real, individually
correct admin/user actions (suspend, remove member, export, request deletion), not one
orchestrated flow. Building a single-click offboarding flow is a real potential future feature, not
a blocker: every underlying capability it would call already exists and is tested.
