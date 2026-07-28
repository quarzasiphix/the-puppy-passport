# Bot 1 — Real-Beta Remediation Matrix

One row per finding/gap surfaced across the VA-01..VA-60 real-beta pass. Cross-references the same
5 High findings tracked in `docs/BOT1_OVERNIGHT_REMEDIATION_MATRIX.md` where applicable (not
duplicated in full detail here — see that file and §12 of
`docs/BOT1_OVERNIGHT_FINALISATION_AUDIT.md` for exact live evidence).

| ID | Severity | Source stage | Summary | Status | Fix owner |
|---|---|---|---|---|---|
| H-1..H-5 | High | VA-07..VA-12 (intersects) | Same 5 open High findings — raw-API paths bypass intended RPCs/roles regardless of UI correctness | Open | Bot 2 |
| VA-25-gap | Medium (= H-3 root cause) | VA-25 | Moderation playbook cannot be technically enforced — `moderation_cases` RLS has no self-conflict exclusion | Open | Bot 2 |
| VA-16/17 | — | VA-16, VA-17 | Consent versioning mechanism (append-only `user_consents`, current-version-only self-insert) | **Adequate — positive finding** | N/A |
| VA-46 | — | VA-46 | Environment separation (local vs. prod) honestly documented | **Adequate — positive finding** | N/A |
| VA-03/04 | — | VA-03, VA-04 | Import/CSV functionality | N/A — confirmed absent | N/A |
| VA-18, VA-29..VA-36, VA-44, VA-56 | — | multiple | Analytics/entitlement/billing/email/CRM surfaces | N/A — confirmed absent (0/72 deps match any provider signature) | N/A |
| VA-42 | Unknown — not yet evaluated | VA-42 | SEO metadata on public routes not independently re-derived this pass | Unverified — recommended next stage | Bot 1 (audit) |
| VA-57 | Unknown — not yet evaluated | VA-57 | Technical buyer/new-team setup walkthrough not independently re-driven | Unverified — recommended next stage | Bot 1 (audit) |
| VA-38, VA-59 | Unknown — not yet evaluated | VA-38, VA-59 | Organisation onboarding / operator takeover reproducibility from docs alone | Unverified — recommended next stage | Bot 1 (audit) |
| VA-05..VA-14 | Unknown — not yet evaluated | VA-05..VA-14 | Browser/accessibility/responsive proof | Explicitly disclosed gap — no live browser available this pass | Bot 1 (audit, needs browser tooling) |
| All remaining VA rows not listed above | Unknown — carried forward | VA-01,02,19..28,39..41,43,45,47..55,58 | Not independently re-derived this pass; existing docs referenced but not re-read in full | Unverified, not assumed adequate | Bot 1 (audit) |

**Resume priority order** (highest-value next VA stages, per the audit's own evidence-over-volume
principle): VA-57 (technical walkthrough — instance was confirmed idle this pass) → VA-42 (SEO, real
working code to inspect) → VA-38/VA-59 (onboarding/takeover reproducibility) → VA-05/VA-06 browser
proof once/if browser tooling is available → remainder in VA-numeric order.
