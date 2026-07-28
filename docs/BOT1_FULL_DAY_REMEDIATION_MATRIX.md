# Bot 1 — Full-Day Remediation Matrix

One row per finding across the full four-pass lineage. Status column reflects **this pass's own
independent re-verification** where marked "re-verified this pass"; otherwise carried forward from
the finalisation pass (`docs/BOT1_FINALISATION_AUDIT.md`) unverified by this pass. Source snapshot
for all "this pass" columns: `8201f17dd4c8abc36cc816d63c52f3620ae7e44f`.

| ID | Severity | Title | Status | This pass's method | Evidence (file/line) |
|---|---|---|---|---|---|
| §5.1 | High | Fundraising campaign self-publish to `active` | **Fixed** (re-verified this pass) | Direct trigger-body read | `supabase/migrations/20260101014000_fundraising_self_publish_lock.sql` — `prevent_fundraising_self_publish()` |
| §5.2 | High | `legal_holds`/`account_deletion_requests` raw-write bypass | **Still open** (re-verified this pass) | Grant + policy text read, traced through all later migrations touching both tables | `20260101011500_legal_holds.sql:40`; `20260101004800_account_deletion_requests.sql:18-30` |
| §5.3 | High | `create_notification_if_enabled()` arbitrary recipient/content | **Still open** (re-verified this pass) | Full function-body read of effective (latest) definition | `20260101012200_notification_template_versioning.sql:18-58` |
| §5.4 | High | `moderation_cases` self-resolution | **Still open** (re-verified this pass) | Policy text unchanged; new migration on this table confirmed narrow (dup-case only) | `20260101013900_moderation_case_report_unique.sql` (does not touch resolution) |
| NEW-H1 | High | `transport_requests` raw status-flip via trigger exemption | **Still open** (re-verified this pass) | Direct trigger-body read | `20260101013400_quotation_dispatch_atomic_rpcs.sql:229` |
| §6.1 | Medium | Quotation terminal-state (RLS half) | Still open (not re-verified this pass) | Carried forward | See `BOT1_FINALISATION_AUDIT.md` §11 |
| §6.2 | Medium | `animal_ownership_history` admin-mutable | Fixed (not re-verified this pass) | Carried forward | See `BOT1_FINALISATION_AUDIT.md` §10 |
| §6.3 | Medium | `user_verifications` raw-approve bypass | **Still open** (re-verified this pass) | Policy text read, traced through all later migrations touching this table | `20260101000550_user_verifications.sql:60-64` |
| §6.4 | Medium | `route_assignments.assigned_by` forgery | **Still open** (re-verified this pass) | Policy + column def read | `20260101001700_routes_and_fleet.sql:135-137,78` |
| §6.5 | Medium | `transport_status_history` forged `changed_by`/status | Partially fixed (`changed_by` half closed; status half open) — not re-verified this pass | Carried forward | See `BOT1_FINALISATION_AUDIT.md` §11 |
| §6.6 | Medium | `buyer_applications.organization_id` cross-org binding | Still open (not re-verified this pass; note a *different* bug on the same table, suspended-org application creation, was closed this delta) | Carried forward + 1 new fact this pass | `20260101013700_suspended_org_application_lock.sql` closes a different gap, confirmed via full read |
| §6.7 | Medium | `transport-evidence` cancellation-revocation | Still open (not re-verified this pass) | Carried forward | See `BOT1_FINALISATION_AUDIT.md` §11 |
| §6.8 | Medium | Verification audit trail (approval/rejection halves) | Approval half fixed this delta; rejection half still open (no `reject_user_verification()` RPC exists) | Re-verified this pass (existence check only) | `20260101013600_admin_command_audit_coverage.sql` (full read); `grep -rl reject_user_verification supabase/migrations/` → empty |
| §6.9 | Medium | `uploaded_by` forgery | Still open (not re-verified this pass) | Carried forward | See `BOT1_FINALISATION_AUDIT.md` §11 |
| §7.1–§7.4, §7.6 | Low | Various (see original report) | Still open (not re-verified this pass) | Carried forward | See `BOT1_FINALISATION_AUDIT.md` §9 |
| §7.5 | Low | `getFriendlyErrorMessage()` wiring | **Fixed** (re-verified this pass, count re-run) | `grep -rl getFriendlyErrorMessage src/ \| wc -l` → 34 (finalisation pass reported 33; 1-file discrepancy noted, not root-caused, immaterial to classification) | `src/` |
| NEW-M1 | Medium | Bot 2's own Stage YR-1 notification-producer audit repeats §5.3's blind spot | Open (not re-verified this pass) | Carried forward | `docs/NOTIFICATION_PRODUCER_INVENTORY.md` |
| NEW-H2 | High | Bot 2's own Stage YR-15 raw-API-bypass audit repeats the same blind-spot pattern, scoped to new code only | Open (not re-verified this pass — existence of cited doc spot-checked only) | Carried forward | `docs/RAW_API_BYPASS_AUDIT.md` (existence confirmed, full content not re-read this pass) |

## Candidate fixes

| Branch | Commit | Finding | Applied to main? | Notes |
|---|---|---|---|---|
| `candidate-fixes/bot1-legal-hold-deletion-raw-write-20260727` (in the finalisation clone, not this clone) | `7ba7b32` | §5.2 | No, never merged/pushed | Target confirmed unchanged and still valid by this pass's independent §5.2 re-verification |

No new candidate fix was created by this pass.
