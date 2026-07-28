# Bot 1 — Adversarial Test Ledger

One row per attempted attack across the full audit lineage. "This pass" = this full-day clone
(`audit/bot1-fullday-20260728-071727`). "Finalisation pass" = the separate, now-frozen clone
(`/p/the-puppy-passport-bot1-finalisation-20260727-235034`, final commit `4fc8223`), cited as
evidence per the coordinator's explicit instruction to fold in its findings, not independently
re-executed by this pass unless noted.

| # | Attack | Actor | Table/RPC | Attempted by | Method | Result |
|---|---|---|---|---|---|---|
| 1 | Self-publish fundraising campaign to `active` | real org owner (`foundation1`) | `fundraising_campaigns` | Finalisation pass | Live, real personas, real fixtures | **REJECTED** (`P0001`) — fixed |
| 2 | Raw status-flip to `accepted_by_customer` | real requester (`customer`) | `transport_requests` | Finalisation pass | Live | **SUCCEEDED** — still open (NEW-H1/H-4) |
| 3 | Raw legal-hold insert, forged `placed_by` | `admin` | `legal_holds` | Finalisation pass | Live | **SUCCEEDED** — still open (§5.2/H-1) |
| 4 | Self-update deletion request to `processed`, forged `processed_by` | real `customer` (non-staff, own row) | `account_deletion_requests` | Finalisation pass | Live | **SUCCEEDED** — still open (§5.2/H-1) |
| 5 | Arbitrary-recipient notification with phishing content | real `customer`, zero relationship to target | `create_notification_if_enabled()` | Finalisation pass | Live | **SUCCEEDED** — still open (§5.3/H-2) |
| 6 | Self-resolve moderation case naming self as affected party | `customer` temporarily granted `moderator` | `moderation_cases` | Finalisation pass | Live | **SUCCEEDED** — still open (§5.4/H-3) |
| 7 | Raw-approve verification, bypassing org/membership/role creation | `admin` | `user_verifications` | Finalisation pass | Live | **SUCCEEDED**, confirmed "approved but broken" (zero resulting `organisations` row) — still open (§6.3) |
| 8 | Forge `route_assignments.assigned_by` | real `ops` | `route_assignments` | Finalisation pass | Live | **SUCCEEDED** — still open (§6.4) |
| 9 | Un-terminal-ize an accepted quotation (accept→reject→accept) | real `customer` | `quotations` | Finalisation pass | Live | **SUCCEEDED** both directions — still open (§6.1 RLS half) |
| 10 | Forge `uploaded_by` on transport document | real `customer` | `transport_documents` | Finalisation pass | Live | **SUCCEEDED** — still open (§6.9) |
| 11 | Self-insert `role='admin', status='active'` | `customer` | `user_roles` | Finalisation pass | Live | **REJECTED** (`42501`) — adequate |
| 12 | Self-insert `role='moderator', status='active'` | `customer` | `user_roles` | Finalisation pass | Live | **REJECTED** (`42501`) — adequate |
| 13 | Self-insert `role='breeder', status='active'` (skip pending) | `customer` | `user_roles` | Finalisation pass | Live | **REJECTED** (`42501`) — adequate |
| 14 | Read `legal_holds` | anonymous | `legal_holds` | Finalisation pass | Live | **REJECTED** — no grant at all — adequate |
| 15 | Read `audit_logs` | anonymous | `audit_logs` | Finalisation pass | Live | **REJECTED** — no grant — adequate |
| 16 | Read `account_deletion_requests` | anonymous | `account_deletion_requests` | Finalisation pass | Live | **REJECTED** — no grant — adequate |
| 17 | Read `user_verifications` | anonymous | `user_verifications` | Finalisation pass | Live | **REJECTED** — no grant — adequate |
| 18 | Read `profiles.email, phone` | anonymous | `profiles` | Finalisation pass | Live | **REJECTED** — no grant — adequate |
| 19 | Read exact addresses on other users' transport requests | real `customer` | `transport_requests` | Finalisation pass | Live | Empty (RLS row-filtered) — adequate |
| 20 | Broad-select support cases | real `customer` | `support_cases` | Finalisation pass | Live | Empty — adequate |
| 21 | Self-insert into `organisation_members` as owner, no prior relationship | real `buyer` | `organisation_members` | Finalisation pass | Live | **REJECTED** (`42501`) — adequate |
| 22 | Self-insert into a *different* org's `organisation_members` as owner | real `breeder2` (already owns a different org) | `organisation_members` | Finalisation pass | Live | **REJECTED** (`42501`) — adequate |
| 23 | Read another org's private member list | real `buyer`, unaffiliated | `organisation_members` | Finalisation pass | Live | Empty — adequate |
| 24 | Self-insert achievement pre-set to `verification_status='approved'` | real `breeder1` (real kennel owner) | `achievements` | Finalisation pass | Live | **SUCCEEDED** — new finding, NEW-H3/H-5, still open |
| 25 | Self-delete own comment/application while under an active legal hold | real `buyer` (real hold placed by real `admin`) | `comments`, `buyer_applications` | **This pass** | Live, real personas, real pre-existing row, DB confirmed idle beforehand | **REJECTED** (`P0001`, exact migration text) — genuinely new test (fix not tested by any prior pass), confirms fix works |

## This pass's own testing posture

This pass performed exactly one new live empirical test (#25 above) in its prior checkpoint round.
For this final consolidation round, per the coordinator's explicit "stop expanding audit breadth"
instruction and this round's own `pg_stat_activity` check showing genuine non-idle activity on the
shared instance at the time of this check (2 non-idle backends, one being this check's own query —
i.e. at least one other real concurrent process), this round relied on **static re-verification**
(direct migration-file reading) for H-1 through H-5 against `LATEST_MAIN`, explicitly stated rather
than silently defaulted to — see the main report's testing section. All static conclusions for H-1
through H-4 corroborate rows 2–10 above; H-5's static conclusion corroborates row 24.

## Not attempted, any pass

`welfare_cases`/`rehoming_reviews`/`reports`/`messages` raw-write and cross-tenant-read fuzzing,
driver/vehicle eligibility raw overrides, Storage bucket path-traversal beyond the already-named
`transport-evidence` gap (§6.7) — flagged by the finalisation pass's own §63 as the next fuzz
targets, not picked up by this pass either.
