# Account security runbook

Real mechanisms only, cross-referencing this session's own verified security work rather than
inventing new claims.

## Suspicious admin/staff access

`require_recent_auth()` (step-up authentication) gates the most sensitive admin actions —
account-deletion execution, legal-hold placement/release — requiring a _recent_ real
re-authentication, not just an existing session (Stage CJH-era work, re-confirmed still wired at
this session's HF-1 fix). Every admin decision on a moderation case, deletion request, or
verification writes a real `audit_logs` row with a server-derived actor — reviewable directly, not
reconstructed from memory.

## Account takeover response

1. **Detect**: unusual activity report from the user, or an admin noticing anomalous audit-log
   entries for a profile.
2. **Contain**: Supabase Auth's own session revocation (admin-side, via Supabase Studio or the
   Auth API) invalidates existing sessions — this app doesn't have its own separate session store
   to worry about, since it relies on Supabase Auth's JWTs directly.
3. **Investigate**: `audit_logs` for the affected profile as actor — real, queryable, admin-only.
4. **Recover**: password reset flow (`/forgot-password` → `/reset-password`) is real and, as of
   this session's Phase 5 fix, doesn't leak the new password into the URL on a fast click.
5. **Notify**: the affected user, plainly, once contained.

## Credential leak response

If a real Supabase anon/service key, or any provider credential, is suspected leaked: rotate it in
Supabase Studio / the relevant provider dashboard (out of this repo's scope — no credentials are
stored in this repo; `.env` is gitignored, confirmed by the repo's own `.gitignore`). This repo has
no production credentials configured at all today (`docs/PRODUCTION_SETUP.md` — not yet stood up),
so the current, real blast radius of any local-only credential is limited to the local dev
environment.

## Notification phishing response

As of this session's HF-2 fix, the arbitrary-recipient notification bypass this runbook would
otherwise need a response procedure for is closed at the RLS/RPC layer — a genuine attacker cannot
use `create_notification_if_enabled()` to phish an arbitrary user anymore (regression-tested). If a
_legitimate_ moderator/org-owner notification is reported as suspicious (e.g. a real staff member
sending a misleading message through a channel they're genuinely authorised to use), that's a
`docs/MODERATION_RUNBOOK.md`/HR concern, not a technical bypass.

## Cross-tenant exposure response

If a genuine cross-tenant data exposure is ever found (a user seeing another org's private data):
treat as Critical, matching this session's own severity discipline for the 5 High findings closed
this pass. Reproduce with a real lower-trust actor before fixing (never assume), fix with the
smallest correct RLS/trigger change, add a regression test proving both the fix and that legitimate
access is preserved, then run the full verification contract — the exact process this session
followed for every one of HF-1 through HF-5.

## What this runbook does not claim

No SIEM, no automated anomaly detection, no external security-monitoring provider — none exist.
Detection today is human-driven (user reports, admin review of `audit_logs`), not automated.
