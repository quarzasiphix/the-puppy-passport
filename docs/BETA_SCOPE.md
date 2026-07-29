# Real-beta scope

Derived from `docs/FEATURE_LAUNCH_MATRIX.md`'s real, verified feature inventory — not a
speculative product plan.

## In scope for a real beta

Every real, tested, RLS-hardened workflow already in the codebase **with a real frontend**: public
marketplace discovery, breeder/foundation onboarding and verification, private rehoming, buyer
applications, reservations, quotations, messaging, moderation, ownership handover/history,
transport requests (both flows), driver/vehicle/route operations, document review, legal holds,
and signup-time consent recording.

None of these need new backend work to be "beta-ready" in the sense of being real rather than
mocked — they already are. What each needs before a **real external pilot** (not local testing) is
covered by the readiness gates already tracked separately: production Supabase infrastructure
(`docs/PRODUCTION_SETUP.md`, not yet stood up), legal review of the `/terms`/`/privacy` draft text
(consent _mechanism_ is real, the _content_ isn't final), and the operational runbooks this session
is producing alongside this document.

## Correction: support cases are backend-only, not in scope for this beta's UI

An earlier version of this document listed "support" alongside the fully-real workflows above.
That was wrong — corrected after direct inspection found `support_cases`/`support_case_messages`
are real, tested at the database layer (`tests/db/support-cases.test.ts` and others), but have
**zero frontend surface anywhere in `src/`**. A pilot participant cannot open a support case
through the app today. Until frontend work builds that UI, real support during any pilot needs an
out-of-band channel (direct email/contact) — see `docs/SUPPORT_RUNBOOK.md` for how to run that
manually against the same real backend semantics (claim, internal notes, resolution) in the
meantime.

## Explicitly out of scope for this beta

- **Fundraising** — deliberately disabled (`VITE_FUNDRAISING_ENABLED=false` in any real build).
  The feature is real and tested but stays off until a genuine payment provider, refund policy,
  and legal text are approved (`docs/FUNDRAISING_POLICY.md`).
- **Payments, analytics/CRM, email (beyond Supabase Auth), SMS** — not out of scope by a flag,
  genuinely not built. No provider dependency exists in `package.json`, no schema exists. Adding
  any of these is real new-feature work, not a beta toggle.

## Disabled-feature enforcement

The one currently-flagged feature (fundraising) is enforced by a client-side flag deliberately, not
by accident: even a client bypassing `FUNDRAISING_ENABLED` and calling the fundraising RPCs/tables
directly cannot move real money, because `fundraising_contributions.is_simulated` is forced `true`
by RLS on every insert regardless of caller (audited at Stage FA-3, re-confirmed while writing this
document). This is the correct shape of "fails safely" for a feature with zero real payment
surface — there's nothing more sensitive to lock at the server layer than what's already locked.

Maintenance mode is edge-enforced only (`src/server.ts`'s Cloudflare Worker `fetch` handler), by
design (Stage YR-18) — there is exactly one real client (this app's own frontend) today, so RPC-
layer maintenance awareness would be speculative infrastructure for a threat that doesn't exist yet.

No other feature in this beta's scope has a "disabled" state to enforce — everything listed as
in-scope above is either fully live or governed by ordinary role/verification checks (already
covered by this session's RLS/trigger work), not a feature flag.

## Next gate

Real external pilots (breeder, foundation, buyer, transport operator, driver — see
`docs/PILOT_ONBOARDING.md`) are blocked on production infrastructure and legal review, not on
backend code. This session's remaining work focuses on what _is_ addressable now: operational
runbooks, import tooling, and closing the documented SSR authentication bug — not on infrastructure
this session has no ability to stand up.
