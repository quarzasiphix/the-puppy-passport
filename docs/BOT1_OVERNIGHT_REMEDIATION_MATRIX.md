# Bot 1 — Overnight Remediation Matrix

One row per finding. Source snapshot `ac612690`. Full evidence: `docs/BOT1_OVERNIGHT_FINALISATION_AUDIT.md` §12–19.

| ID | Severity | Table/Function/Migration | Actor | Status | Live-confirmed this pass | Candidate fix |
|---|---|---|---|---|---|---|
| H-1 / §5.2 | High | `account_deletion_requests` RLS `ALL` self-policy | any authenticated user, own row | Open | Yes — `pg_policies` read | `7ba7b32` (finalisation clone only; filename collision with real `20260101013600_admin_command_audit_coverage.sql`, needs renumber) |
| H-2 / §5.3 | High | `create_notification_if_enabled()` SECURITY DEFINER, EXECUTE to `authenticated` | any authenticated user | Open | Yes — `\df+`/`pg_proc.proacl` read | None |
| H-3 / §5.4 | High | `moderation_cases` RLS `ALL is_moderator()` policy | any moderator, incl. conflicted | Open | Yes — `pg_policies` read | None |
| H-4 / NEW-H1 | High | `prevent_non_staff_operational_field_changes()` trigger, `transport_requests` | requester/customer, own row | Open (regression) | Yes — `\sf` trigger body read + RLS read | None |
| H-5 / NEW-H3 | High | `achievements.verification_status`, `owns_org()` RLS policy | organisation owner, own achievement | Open | Yes — `pg_policies` read | `3f4db66` (finalisation clone only; no collision) |
| §5.1 | High (fixed) | fundraising publish, `20260101014000` | — | Fixed | Not re-run this pass (no delta) | — |
| §6.2 | Medium (fixed) | `animal_ownership_history` | — | Fixed | Not re-run this pass | — |
| §7.5 | Low (fixed) | `getFriendlyErrorMessage`, 34 sites | — | Fixed | Not re-run this pass | — |
| FA-4 | High (fixed) | legal-hold propagation, `buyer_applications` self-delete | — | Fixed | Not re-run this pass | — |
| §6.1 | Medium | `respond_to_quotation()` RPC (fixed half) / RLS (open half) | customer | Partial | RLS half reconfirmed live via H-4 (same table) | — |
| §6.3, §6.4, §6.6, §6.7, §6.9 | Medium | various broad-`ALL`-policy tables; Storage evidence revocation | various | Open | Not re-verified live this pass | — |
| §6.5 | Medium | `stamp_changed_by_actor()` (fixed half) / status (open half) | various | Partial | Not re-verified this pass | — |
| §6.8 | Medium | `20260101013600_admin_command_audit_coverage.sql` (approval half fixed) / rejection half (no RPC) | admin | Partial | Not re-verified this pass | — |
| NEW-M1 / NEW-H2 | Medium (process) | Bot 2 self-audit methodology scope | — | Open | Not re-verified this pass | — |
| §7.1–7.4, §7.6 | Low | documentation drift / minor polish | — | Open | Not re-verified this pass | — |
| VA-25-gap | Medium (= H-3 root cause, cross-referenced) | same as H-3 | moderator | Open | Yes (same evidence as H-3) | None |

See `docs/BOT1_REAL_BETA_REMEDIATION_MATRIX.md` for the VA-tier findings/gaps layered on top of this
table.
