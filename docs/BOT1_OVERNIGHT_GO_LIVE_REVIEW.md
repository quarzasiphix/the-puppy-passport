# Bot 1 — Overnight Go-Live Review

One row per go-live requirement. Source snapshot `ac612690`. Depends on the release gate
(`docs/BOT1_OVERNIGHT_RELEASE_GATE.md`) passing first, which it does not.

| Requirement | Status | Evidence |
|---|---|---|
| Release gate passes | **Fail** | See release gate doc — 5 open High |
| Auth/account recovery usable | Not independently re-verified this pass | `src/lib/auth/actions.ts`, `_public.forgot-password.tsx` exist; carried forward from lineage |
| Public marketplace routes work | Not independently re-verified this pass | Carried forward from Domain D |
| Organisation onboarding works | **Unverified — real gap** | VA-38, not independently re-driven by any Bot 1 pass to date |
| Buyer application works | Not independently re-verified this pass | Carried forward |
| Messaging/support/moderation work | **Partial fail** | Moderation has a live-confirmed self-conflict enforcement gap (H-3/VA-25) |
| Transport scope for launch works | **Partial fail** | Live-confirmed customer-side raw status-forgery gap (H-4) on the exact quotation-acceptance flow |
| Disabled features fail safely | Not independently re-verified this pass | Maintenance-mode schema exists, not re-read |
| Customer-facing errors safe | Carried forward as fixed | §7.5 `getFriendlyErrorMessage`, not re-run this pass |
| Privacy/terms placeholders ready for legal review | **Pass, honestly labelled** | Consent-versioning migration explicit that current version is a "-draft" pending lawyer review |
| Monitoring/incident ownership placeholders exist | Not independently re-verified this pass | `docs/INCIDENT_RUNBOOKS.md` exists |
| Backup/restore assumptions documented | Not independently re-verified this pass | `docs/BACKUP_AND_DISASTER_RECOVERY.md` exists |
| Demo/support teams understand limitations | Not independently re-verified this pass | No sales/support collateral exists to check |

**Go-live verdict: Not ready.** Blocked primarily by the release gate; independently also blocked by
two live-confirmed operational gaps (moderation self-conflict, transport status forgery) that sit
directly on core launch-scope flows, and by an unverified (not failed, but genuinely untested)
organisation-onboarding reproducibility gap.
