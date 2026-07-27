# Bot 1 — Remediation Matrix (Finalisation Pass)

One row per known finding, consolidated across all three Bot 1 passes (original audit, remediation
verification, this finalisation pass). Status as of this pass's audited snapshot
`26f1b2ef6b1a43315d11512e22983500dcd8e788`. "Verified" = independently re-confirmed this pass, live
where the shared instance allowed it, static (migration-text tracing) otherwise. See
`docs/BOT1_FINALISATION_AUDIT.md` for full evidence per finding; this table is the index.

| ID | Finding | Severity | Priority | Status | Fixing commit | Verified this pass | Candidate fix |
|---|---|---|---|---|---|---|---|
| §5.1 | Fundraising campaigns self-publish to `active` | High | P0 | **Still open** | none | Yes — live `pg_policies`, unchanged | No |
| §5.2 | `legal_holds`/`account_deletion_requests` raw-write bypass (widened: any user, own row) | High | P0 | **Still open** | none (audit-trail-only `d2d5d62` doesn't touch it) | Yes — live `pg_policies` + `role_table_grants`, unchanged | **Yes** — `candidate-fixes/bot1-legal-hold-deletion-raw-write-20260727` @ `7ba7b32` |
| §5.3 | `create_notification_if_enabled()` arbitrary recipient/content | High | P1 | **Still open** | none | Yes — live `has_function_privilege`, still true | No |
| §5.4 | `moderation_cases` self-resolution conflict of interest | High | P1 | **Still open** | none | Yes — live `pg_policies`/`pg_trigger`, unchanged | No |
| NEW-H1 | `transport_requests` raw status-flip via `20260101013400`'s trigger exemption | High | P1 | **Still open** (found in remediation pass, this pass confirms unchanged) | none | Yes — live trigger body re-read, exemption clause present unchanged | No |
| §6.1 | Quotation terminal-state gap | Medium | P2 | **Partially fixed** (RPC path closed `cfd33ca`; raw RLS still open) | `cfd33ca`/`20260101013400` | Yes — live `pg_policies`, unchanged | No |
| §6.2 | `animal_ownership_history` admin-mutable | Medium | — | **Fixed** | `281f0e4`/`20260101012900` | Yes — live `pg_policies`, admin-SELECT/INSERT-only confirmed | n/a |
| §6.3 | `user_verifications` raw-write bypass | Medium | P0 (bundle with §5.2) | **Still open** | none | Yes — live `pg_policies`, unchanged | No |
| §6.4 | `route_assignments.assigned_by` forgery | Medium | P0 (bundle with §5.2) | **Still open** | none | Yes — live `pg_policies`, unchanged | No |
| §6.5 | `transport_status_history` forged `changed_by`/unconstrained `status` | Medium | P2 (status half) | **Partially fixed** (`changed_by` closed `3e4ae1f`; `status` still open) | `3e4ae1f`/`20260101013000` | Yes — trigger + policy re-read, status half unchanged | No |
| §6.6 | `buyer_applications.organization_id` cross-org PII binding | Medium | P1 | **Still open** | none | Not re-queried live this pass (no delta migration touches it — static confirmation via `grep` only) | No |
| §6.7 | `transport-evidence` cancellation-revocation gap | Medium | P2 | **Still open** | none | Not re-queried live this pass (no delta migration touches it — static confirmation only) | No |
| §6.8 | Verification approval/rejection audit trail | Medium | P2 | **Still open** | none | Not re-queried live this pass (static confirmation only) | No |
| §6.9 | `uploaded_by` forgery on `transport_documents`/`welfare_case_documents` | Medium | P2 | **Still open** | none | Not re-queried live this pass (static confirmation only) | No |
| §7.1 | `convert_application_to_reservation()` raw constraint-name leak | Low | P3 | Open (not re-verified this pass) | none | No | No |
| §7.2 | `rehoming_reviews` admin approval missing `OLD.admin_status` guard | Low | P3 | Open (not re-verified this pass) | none | No | No |
| §7.3 | `markDeletionRequestProcessed()` `declined` path trusts client `processedBy` | Low | P3 | Open — **this pass's own candidate fix does not close this**: the admin decline path still passes a client-supplied `processedBy` through to the raw update; the migration only blocks the `processed` transition, not actor-forgery on `declined`. Left open deliberately (fixing it means changing `src/lib/queries/privacy.ts`'s call signature, judged outside "smallest, no-frontend-impact" scope for this pass's candidate fix). | none | Partially re-examined (found while building the candidate fix, see §5.2 area of main report) | No |
| §7.4 | ~127 unindexed FK columns | Low | P3 | Open, documented, deliberate tradeoff | none | No | No |
| §7.5 | `getFriendlyErrorMessage()` wired into 1 of 4 call sites | Low | P3 | **Still open** | none | Yes — `grep` re-confirms exactly the same 2 files as before | No |
| §7.6 | `rpc-grant-hygiene.test.ts` weak `assert.ok(error)` assertion | Low | P3 | **Still open** — Bot 2 has since proven the correct pattern in a newer file (`has-role-execute-lock.test.ts`) but never backported it | none | Yes — file re-read, unchanged | No |
| NEW-M1 (this pass) | Bot 2's own Stage YR-1 `NOTIFICATION_PRODUCER_INVENTORY.md` claims "no forgeable-recipient surface to close here" for the notification pipeline while never mentioning `create_notification_if_enabled()`'s own direct-RPC grant/authorization gap (§5.3) — a progress-document truth-check finding, not a new code bug | Medium (doc/process) | P3 | **New this pass** | none | Yes — doc re-read in full, function name never appears in either new audit doc | No |

**Totals across all 22 rows**: 1 fixed, 2 partially fixed, 18 still open (4 High, 9 Medium/wide,
5 Low, 1 new doc-process finding), 1 candidate fix committed (closes §5.2's RLS/grant half fully;
§7.3's client-`processedBy` issue on the `declined` sub-path is explicitly NOT closed by it, see
above).

**Verification-depth note (§6.6/§6.7/§6.8/§6.9/§7.1/§7.2/§7.4)**: these were confirmed **statically**
this pass (no migration in the `c8bc235..26f1b2e` delta touches any of their tables — see
`docs/BOT1_FINALISATION_AUDIT.md` §14) but were not independently re-queried against the live
database this pass, since the 8-commit delta since the last live-verified pass contains zero new
migrations at all (confirmed via `git diff --stat c8bc235..26f1b2e -- supabase/migrations`, empty)
— a static "no file changed" proof is exhaustive here, not a shortcut, because the entire class of
change that could fix an RLS/grant/trigger finding (a new migration) provably did not happen.
