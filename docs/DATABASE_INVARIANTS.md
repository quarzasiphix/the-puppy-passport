# Database Invariants

Stage CB of the autonomous backend-hardening session (see `docs/AUTONOMOUS_BACKEND_PROGRESS.md`).
`docs/DOMAIN_MODEL.md` describes what tables *mean* and how they relate; this document is a
different, complementary thing — a catalogue of what's actually *guaranteed to always be true* in
this database, and exactly where each guarantee is enforced, so future work can check "does an
invariant already exist here" before adding a column, policy, or RPC that might quietly violate
one. Every entry below is a real, currently-enforced constraint/trigger/policy — not an aspiration.

## Uniqueness ("at most one X")

| Invariant | Enforced by | Migration |
|---|---|---|
| Exactly one row ever exists in `app_maintenance_mode` | `check (id)` on a `boolean primary key default true` | `20260101011000` |
| At most one `is_current = true` `legal_document_versions` row per `document_type` | Partial unique index | `20260101010200` |
| At most one active (`status <> 'cancelled'`) `reservations` row per `animal_id` | Partial unique index | `20260101009400` |
| At most one `conversations` row per `transport_request_id` | Partial unique index | `20260101009400` |
| At most one active (`not in ('withdrawn','rejected','converted_to_reservation')`) `buyer_applications` row per `(buyer_id, animal_id)` | Partial unique index | `20260101001000` |
| Exactly one `stop_order` value per `route_id` in `route_stops` | Unique index | `20260101009900` |
| At most one non-null `animals.microchip_number` value across the whole table, case/whitespace-insensitive | Functional partial unique index | `20260101010700` |
| One `risk_signals` row per `(subject_profile_id, signal_type)` — a repeat increments `occurrence_count` instead of duplicating | Table-level `unique` + `record_risk_signal()`'s `on conflict do update` | `20260101010500` |
| One conversation per `(animal_id, buyer_id)` application thread | `pg_advisory_xact_lock` inside `start_application_conversation()` (no plain unique index fits — multiple buyers legitimately each get one) | `20260101009400` |

## Server-stamped actors (never client-forgeable)

Every one of these columns is set from `auth.uid()` inside a `SECURITY DEFINER` function or an RLS
`WITH CHECK` clause — never trusted as a client-supplied value, even from a "trusted" staff role:

- `audit_logs.actor_profile_id` — RLS-locked (`20260101009300`).
- `notifications.actor_profile_id` — RLS-locked.
- `transport_status_history`/`transport_requests` operational changes — `change_ops_request_status()` (`20260101009200`).
- `route_assignments.assigned_by` — `assign_request_to_route()` (`20260101009300`).
- `transport_documents.reviewed_by`/`reviewed_at` — trigger, ops-only, only on the accept/reject transition (`20260101009600`).
- `moderation_cases.assigned_moderator_id` — `claim_moderation_case()`, atomic `select ... for update` (`20260101010300`).
- `support_cases.assigned_staff_id` — `claim_support_case()`, same shape (`20260101010400`).
- `app_maintenance_mode.enabled_by`/`enabled_at` — trigger, re-stamped on *every* update that leaves `enabled = true`, not just the transition (`20260101011000`).
- `risk_signals.reviewed_by` — `mark_risk_signal_reviewed()` (`20260101010500`).
- `driver`/route status-progression actor — `advance_transport_job_status()` (`20260101010000`).
- `execute_account_deletion()`/`approve_user_verification()` — admin-only, actor implied by the caller, never a parameter.

## State locks ("once X, Y can never change again")

- `transport_documents`: once `status = 'accepted'`, the row is fully locked from requester-side
  changes of any kind — not just the review fields (`20260101009600`).
- `quotations`: a requester can only ever change `status`, never `total_price` or any other
  ops-controlled field, even on the same UPDATE (`20260101008400`).
- `buyer_applications`: a buyer can never self-approve, at INSERT *or* UPDATE — the org-controlled
  fields (`status`, `breeder_response`) are locked both ways (`20260101007800`/`20260101008900`).
- `rehoming_reviews`: an owner can never insert their own review pre-approved — private rehoming
  always goes through real admin review (`20260101008800`).
- `fundraising_campaigns`: an org can never self-declare `target_reached`/`partially_funded` —
  those are admin-only outcome states (`20260101009100`).
- `messages`/`support_case_messages`: `is_internal` can never be set `true` by a non-staff sender,
  at INSERT (`20260101008600`/`20260101010400`).
- `transport_requests`: operational fields (`assigned_route_id`, `vehicle_id`, `driver_id`,
  `compliance_review_result`, `visibility`, and more) are locked from the requester once the
  request exists — only ops/admin can change them (`20260101006000`).
- Post-submission snapshot lock: once a `transport_requests` row leaves `draft`, its animal/party
  snapshot fields and `transport_request_animals`/`transport_parties` rows are locked from the
  requester (ops retains a correction path) (`20260101007000`).

## Role/suspension invariants

- Suspending a `user_roles` row (`status <> 'active'`) immediately revokes that role's gated
  access — verified across ops, driver, kennel/foundation/shelter/rescue org-owner, and non-owner
  org-member roles (`tests/db/workflows.test.ts`'s suspension scenario, closing gaps found at
  `20260101006100` and `20260101009800`).
- Organisation *ownership* (`organisations.owner_user_id`) is a separate concept from a role row —
  an admin's access never depends on `owns_org()` at all, and `owns_org()` itself checks the
  caller's *active* role, not just row ownership.
- `owner_user_id` can never be changed by anyone except an admin — an org owner cannot silently
  transfer/orphan their own organisation (`20260101007700`).

## Referential/business-value invariants

- `currency` is always `'EUR'` or `'PLN'` across all 8 columns that carry one — `CHECK` constraints
  (`20260101010100`).
- `fundraising_contributions.is_simulated` is always `true` — RLS forces it on every INSERT
  regardless of what a raw API call requests; no real payment has ever been recorded by this schema.
- Rate-limited actions (`rate_limit_events`) are bounded per `(actor_profile_id, action_key)` within
  each action's configured window; stale rows self-prune on the actor's own next attempt after the
  window elapses, keeping the table from growing unbounded (`20260101010900`).
- `risk_signals` is advisory-only by construction — no code path anywhere reads it to automatically
  suspend, block, or otherwise punish an account; only a human (`mark_risk_signal_reviewed()`) ever
  acts on one.

## Deletion/lifecycle invariants

- No table in this schema hard-deletes a `profiles` row — account removal is always
  `execute_account_deletion()`'s anonymisation, and only after confirming no real unresolved
  obligation exists (an active transport request, reservation, application, or un-transferred
  organisation ownership) (`20260101009500`).
- Audit-trail FK columns pointing at `profiles` (`reviewed_by`, `assigned_moderator_id`,
  `uploaded_by`, and similar) deliberately have no `ON DELETE` action (`RESTRICT`) — a staff
  account can't be hard-deleted out from under the trail it left, by design (Stage L's audit).
- User-owned content FKs (an animal's owner, a message's sender) correctly `ON DELETE CASCADE`,
  the opposite choice, because that content has no meaning once its owner is truly gone.
- `transport_status_history` and `audit_logs` are append-only for everyone, including ops/admin —
  no UPDATE or DELETE policy exists for either table at all, at the Data API layer, for any role
  (`20260101011300`, matching `audit_logs`' own precedent since Stage AE).

## Visibility invariants (never exposed beyond their real audience)

- Exact pickup/delivery addresses (`pickup_address_exact`/`destination_address_exact`) are never
  in any public-facing query or view — only `public_transport_requests` (the deliberately
  hand-picked-column public view) and RLS-scoped direct table access ever touch the parent table.
- `profiles.email`/`profiles.phone` are excluded from `authenticated`'s column grant entirely —
  `get_my_profile()` is the only path back to your own contact details, and it's the only function
  that can see them at all outside `service_role`.
- `messages.is_internal`/`support_case_messages.is_internal` rows are filtered out of every
  non-staff SELECT policy, not just hidden in the UI.
- Storage documents (`transport-documents`, `welfare-case-documents`, `message-attachments`,
  `transport-evidence`) are all private buckets — every access is a short-lived signed URL
  generated on demand, never a persisted public link.

## What this document deliberately does not attempt

- An exhaustive line-by-line list of every `NOT NULL`/foreign-key constraint — those are
  ordinary schema hygiene, not the kind of invariant someone extending this schema needs a
  catalogue to remember.
- Invariants for tables/features that don't exist yet (payments, real email delivery, bulk import) —
  see `docs/AUTONOMOUS_BACKEND_PROGRESS.md`'s "Known open items" for what's deliberately deferred
  and why.
