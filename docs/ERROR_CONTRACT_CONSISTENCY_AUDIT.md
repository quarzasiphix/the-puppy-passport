# Error-contract consistency (Stage YR-16)

## The real, large gap this stage closed

Stage BQ already built the right tool: `getFriendlyErrorMessage()` (`src/lib/errors.ts`) — a
single, well-reasoned function that passes through this schema's own plain-language `P0001`
business-rule messages, replaces recognised technical Postgres/PostgREST error codes (`23505`
unique violation, `23503` FK violation, `23514` check violation, `42501`/`PGRST301` permission
denied, `PGRST116` not found) with safe generic equivalents, and falls back to a single generic
message for anything unrecognised. It was built and correct, but **only wired into 1 of 88
customer-facing `toast.error(...)` call sites** — the other 87 still passed `err.message` (or
`err instanceof Error ? err.message : "..."`) straight to the screen, exactly the raw-Postgres-
leak Stage BQ's own doc named as the concrete, reachable risk it was built to prevent.

## What changed

Wired `getFriendlyErrorMessage()` into **32 genuinely customer-facing route files** (54 total
non-admin/non-operations call sites had it missing; ops/admin dashboards are correctly exempt per
CLAUDE.md — "internal dashboards can and should stay precise and technical," not touched here).
30 files matched the exact `err instanceof Error ? err.message : "..."` idiom and were converted
mechanically (same transformation, `getFriendlyErrorMessage(err, "<same fallback text>")`,
preserving every existing fallback message verbatim); 2 more
(`_public.create-breeder.tsx`, `dashboard.buyer.profile.tsx`) used a different `if (error) {
toast.error(error.message); }` shape from a raw Supabase call and were fixed by hand, same
transformation.

**Deliberately left unchanged**: `_public.signin.tsx`/`_public.signup.tsx` (`toast.error(result.error)`
from `signIn()`/`signUp()` server actions, which already return a plain GoTrue Auth string, never a
raw Postgres error) and `_public.reset-password.tsx` (`supabase.auth.updateUser()`'s own error —
also GoTrue, not Postgres). None of these three route through PostgREST/Postgres at all, so there
is no technical error code to translate — `getFriendlyErrorMessage()` would be a no-op wrapper
around an already-safe string.

## "Ensure conflict/forbidden/stale_write/validation_failed/rate_limited/reauthentication_required/feature_disabled remain distinguishable"

Checked directly: every one of these is already a distinguishable `P0001` with its own specific,
already-customer-safe message text (`enforce_rate_limit()`, `require_recent_auth()`, the
terminal-state guards, the stale-write guards from Stage XR-8) — `getFriendlyErrorMessage()`
passes `P0001` through unchanged by design, so none of this rollout affects those messages at all;
they were already correct. `feature_disabled`/`maintenance_mode` are likewise their own distinct
`P0001` messages, unaffected. Nothing to fix here beyond what Stage BQ already built.

## Verification

- `npx tsc --noEmit` — clean across all 32 changed files.
- `npx eslint` on all 32 changed files — clean.
- `npm run build` — clean.
- Full `npm run test:db`: unaffected (pure frontend change, no schema/RPC touched) —
  **1006/1006**, same as YR-15.
- Full-repo `npx eslint .`: baseline unchanged at 21 errors/13 warnings, none from these files.
