# Bot 1 — Final Accessibility, Responsive, and Localisation Certification

## Scope actually covered this session

Given browser tooling was only confirmed functional in the final round of this session (see
`docs/BOT1_FINAL_BROWSER_CERTIFICATION.md`), no dedicated accessibility/responsive/localisation
browser pass was performed — this is a genuine, disclosed scope gap, not a claim of coverage.

## What can be said from code-level inspection (prior rounds)

- The codebase uses shadcn/Radix UI primitives throughout (`src/components/ui/*`), which carry
  real accessibility behavior by default (focus trapping in dialogs, keyboard navigation, ARIA
  roles) as a property of the underlying library — this is a structural positive, not independently
  re-verified against this app's actual usage of those primitives.
- Real ARIA state was directly observed this round on the sign-in form (`aria-invalid` attribute
  present and correctly toggling based on validation state) — a genuine, if narrow, positive data
  point for form-error accessibility, not a full audit.
- Long-string handling (Polish-language UI copy) not independently tested this session at all.
- Mobile/tablet responsive layouts not independently tested this session at all (`viewport`
  emulation was not used in this round's browser probes).

## Decision impact

**Not a blocker classification is possible yet** — this is genuinely unverified, not verified-clean
and not verified-broken. Recorded as an open item for the next round, now that real browser tooling
is confirmed available. Should be treated as a **real-beta readiness open item**, not assumed
adequate, until an actual keyboard-only navigation pass, a mobile-viewport pass, and a Polish-string
long-content pass are run.

## Recommended next concrete steps (given tooling is now confirmed functional)

1. Keyboard-only navigation through the sign-in/signup/apply/transport-request flows (tab order,
   visible focus, no keyboard traps).
2. Mobile-viewport (375px) pass on the homepage, discovery, and at least one form flow.
3. A Polish-locale pass on 2-3 content-heavy pages (community, transport request form) to check for
   layout breakage from longer strings.
4. `axe-core` or an equivalent automated scan on the 3-4 highest-traffic public pages, now that a
   real browser is confirmed drivable in this environment.
