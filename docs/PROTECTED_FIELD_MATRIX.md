# Protected-field mutation matrix

Stage XR-1 (append-only queue). This schema's single most repeated bug class, across dozens of
stages this session: a table has RLS granting a less-privileged actor (a buyer, a customer, an
organisation, a driver) row-level UPDATE access on a row they also share with a more-privileged
actor (an org, ops staff, an admin) — but RLS is **row-level, not column-level**, so "you can
update rows you own" silently also means "you can update *any column* on rows you own," including
ones that were only ever meant to move under the more-privileged actor's control. This document is
the consolidated map of every table with that shape, what's actually protected today, and how.

Built from a real audit of every `prevent_*`/`*_lock` trigger in `supabase/migrations/`, not
guessed — cross-referenced against each trigger's own migration file. One real, previously-
uncovered gap was found and closed while building this (`support_cases`, marked below); everything
else confirmed already correctly locked.

## The matrix

| Table | Protected field(s) | Restricted actor | Legitimate self-service write kept open | Mechanism | Migration |
|---|---|---|---|---|---|
| `transport_requests` | `status`, `compliance_review_result`, `assigned_route_id`/`assigned_driver_id`/`assigned_vehicle_id`, other operational columns | The requester (customer) | Draft-stage edits, `respondToQuotation()`'s `status` transition | `prevent_non_staff_operational_field_changes()` (BEFORE UPDATE trigger, OLD/NEW diff) | `20260101006000` |
| `transport_requests` | Booking-time snapshot columns (animal/route/compliance/declaration fields) | The requester, once the request leaves `draft` | The amendment-request workflow (a separate, ops-reviewed change path) | `prevent_customer_snapshot_changes_after_submission()` | `20260101006900` |
| `transport_request_animals`, `transport_parties` | Insert/update/delete of animal/party rows | The requester, once the parent request leaves `draft` | Full self-service while still a draft | `prevent_animal_and_party_changes_after_draft()` | `20260101007000` |
| `transport_requests` | `status` beyond the driver's own next legitimate step; `assigned_route_id`/`assigned_vehicle_id`/`assigned_driver_id`/`compliance_review_result`/`visibility` | The assigned driver | Progressing status one legitimate step forward via `advance_transport_job_status()` | Driver status state machine | `20260101011100` |
| `quotations` | `total_price`, `base_price`, every ops-set pricing/terms column | The requester | Accepting/rejecting via `status` only | `prevent_requester_writes_to_ops_controlled_quotation_fields()` | `20260101008400` |
| `quotations` | Accepting an already-`expiry_date`-passed quotation | The requester | Rejecting an expired quotation (always harmless) | RLS policy extension (not a trigger — a status-transition guard) | `20260101012400` (Stage IR-9) |
| `transport_documents` | `status`, `reviewed_by`, `reviewed_at` (review fields) | The requester | Uploading new documents; replacing a not-yet-accepted one | `prevent_requester_writes_to_document_review_fields()` | `20260101009600` (Stage AP) |
| `buyer_applications` | `status` (beyond the buyer's own `withdrawn`), every org-controlled column | The buyer, on UPDATE **and** INSERT | Withdrawing their own application | `prevent_buyer_writes_to_org_controlled_fields()` | `20260101007800`, extended to INSERT at `20260101008900` |
| `rehoming_reviews` | `admin_status` | The animal owner, on INSERT | Submitting a review request (defaults to pending) | RLS INSERT policy restricted to a non-approved initial value | `20260101008800` |
| `organisations` | `verification_status`, `is_featured`, `owner_user_id` | The organisation's own owner | Ordinary public-profile edits (name, description, media, etc.) | `prevent_org_owner_transfer_by_non_admin()` (extended to cover `is_featured` and, later, `verification_status`) | `20260101008100`, extended at `20260101011700` (Stage CJM) |
| `welfare_cases` | `status` beyond the org's own editable window, `ops_acknowledged*`, `review_notes` | The submitting organisation | Editing while `draft`/`submitted`/`information_required` | RLS UPDATE policy scoped by `status in (...)` | `20260101007600` |
| `welfare_case_documents` + the `welfare-case-documents` Storage bucket | Insert/update/delete of evidence, once the case leaves the editable window | The submitting organisation | Viewing at any time; uploading/editing while still editable | Split SELECT/INSERT/UPDATE/DELETE RLS policies, table + Storage | `20260101012500` (Stage IR-11) |
| `moderation_appeals` | `status`, `reviewed_by`, `reviewed_at`, `outcome_notes` | The appellant | Submitting the appeal itself (one-shot, unique per case) | Single-writer RPC (`review_moderation_appeal()`), no direct table UPDATE grant to the appellant at all | `20260101007900` |
| `audit_logs` | `actor_profile_id` | Any ops/admin writer | Writing the log entry itself | RLS `with check (actor_profile_id = auth.uid())` | `20260101009300` |
| `notifications` | `actor_profile_id` | Any caller crediting an action to a "sent by" identity | Creating a notification for a recipient (via `create_notification_if_enabled()`) | Server-stamped in the SECURITY DEFINER function, never client-supplied | `20260101006400` |
| **`support_cases`** | `priority`, `category`, `subject`, `assigned_staff_id`, `related_entity_type`/`related_entity_id` | The requester, on the one UPDATE they're granted (reopening) | Reopening a resolved/closed case (`status → 'reopened'`) | **Found this stage**: the reopen RLS policy's `with check` only ever verified the new `status`, not that every other column stayed equal — a requester's UPDATE could smuggle in a priority bump or a self-assignment alongside a legitimate reopen. Closed by `prevent_requester_writes_to_staff_controlled_support_fields()`, the same allowlist-diff shape as `prevent_buyer_writes_to_org_controlled_fields()`. | `20260101012700` (this stage) |

## Tables checked and confirmed to need no protected-field lock

- **`moderation_cases`**: single-writer (`is_moderator() for all`) — no second, less-trusted role
  ever has row-level write access to share a row with, so the column-lock bug class structurally
  can't occur (same reasoning already documented for `breeds`/`product_service_categories` in
  earlier stages' taxonomy audit).
- **`route_assignments`, `routes`**: ops-only writer, same shape.
- **`legal_holds`, `deletion_blocker_graph`-related tables**: admin/moderator-only `for all`,
  same shape.
- **`animals`**: the owning organisation/profile is the sole legitimate writer of its own listing;
  no second actor shares row-level write access to the same animal row (a buyer/applicant never
  gets an UPDATE policy on `animals` at all — only the owner does).
- **`fundraising_campaigns`**: `target_reached`/`partially_funded`/other outcome statuses were
  already moved to admin-only (`20260101009100_fundraising_outcome_status_lock.sql`, matching this
  exact bug class); campaign-purpose fields are locked after a real payment exists
  (`prevent_fundraising_purpose_change_after_payment()`, `20260101005600`).

## What this stage did not change

No existing lock trigger's behaviour was altered. Only one new trigger was added
(`support_cases`), scoped to exactly the gap demonstrated above — per this stage's own instruction
("add locks only for demonstrated gaps"), nothing else in the matrix was touched even though
building it required re-reading every existing lock trigger in full.
