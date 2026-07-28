# Bot 1 — Overnight Release Gate

One row per release-gate condition. Source snapshot `ac612690`.

| Condition | Status | Evidence |
|---|---|---|
| No open Critical | **Pass** | 0 Critical across the entire 5-pass lineage |
| No unaccepted open High | **Fail** | 5 open (H-1..H-5), all live-reconfirmed this pass, none formally accepted |
| Fresh reset passes | Not run this pass | Scope decision — see main report §3/§81 |
| Full suite passes twice | Not run this pass | Same |
| Stateful suite (3rd pass) | Not run this pass | Same |
| TypeScript passes | Not run this pass | CI (`.github/workflows/ci.yml`) runs `tsc --noEmit` on every push; not independently re-triggered |
| Build passes | Not run this pass | CI runs build on every push; not independently re-triggered |
| Release preflight passes | Not run this pass | `docs/RELEASE_PREFLIGHT_SELF_TEST.md` exists, not re-read/re-run |
| Migration prefixes unique on `main` | **Pass** | Re-confirmed this pass: `20260101013600` exists exactly once on real `main`; only the *candidate fix* `7ba7b32` (never applied to main) would collide |
| RLS/grants/SECURITY DEFINER/Storage verified | **Partial** | Verified live this pass for the 5 tables/functions tied to open Highs; no full 145-table sweep this pass |
| Browser smoke covers critical flows or blockers explicitly accepted | **Fail (disclosed, not accepted)** | No live browser available this pass — explicitly disclosed as a gap in `docs/BOT1_REAL_BETA_AUDIT.md` VA-05..VA-14, not accepted as a blocker waiver |
| Accessibility/responsive baseline acceptable | Not evaluated this pass | Same gap |
| Privacy/consent boundaries documented | **Pass** | Consent-versioning mechanism live-read this pass (VA-16/17), genuinely adequate |
| Support/incident runbooks exist | Docs exist, not re-verified operable | `docs/SUPPORT_OPERATIONS_BOUNDARY_AUDIT.md`, `docs/INCIDENT_RUNBOOKS.md` |
| Maintenance/rollback documented | Docs exist, not re-verified | `docs/MAINTENANCE_DEGRADATION_AUDIT.md` |
| External providers safely disabled until configured | **Pass, trivially** | No provider is wired up at all — nothing to fail unsafely |
| Legal uncertainties disclosed | **Pass** | `/terms`/`/privacy` explicitly marked draft/pending-lawyer-review in both the consent-versioning migration's own comments and `docs/PRODUCTION_READINESS_REPORT.md` |

**Release gate verdict: Fail** — on the unaccepted-open-High condition alone, which is sufficient by
itself regardless of the other rows.
