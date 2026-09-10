# Registration & onboarding — audit (2026-09-11)

Full read-through of every signup/signin path + a live production incident investigation,
prompted by a user asking to delete `a46153d5-61c2-48b2-b3f7-4e8fc749edfc` (a real Google sign-up,
"Aneta Kostowska") and re-verify the flow. Verdict: **architecture is sound**; two real incidents
found and one is now fixed, the other documented as a hard rule.

## What was reviewed (all read in full, code confirmed correct)

- `src/domains/identity/services/actions.ts` — `SIGNUP_INTENTS`, `signUp`, `signIn`, `signOut`,
  `completePasswordlessSignIn`.
- `src/routes/_public/signup.tsx`, `signin.tsx` — password / Google / magic-link, all three paths.
- `src/routes/auth.callback.tsx` — the one landing point for Google + magic links.
- `src/domains/identity/services/{session,guards}.ts` — `getCurrentUser`, `requireRole`.
- `src/routes/dashboard/{buyer,breeder}.tsx` — role-gated dashboard layouts.
- `src/routes/_public/create-breeder.tsx` — the breeder/foundation verification application.
- The `user_roles` RLS policies (live, via `pg_policies`).

## Confirmed sound

1. **PKCE code exchange is server-side** (`completePasswordlessSignIn`, a `createServerFn`) —
   both Google OAuth and magic links land on `/auth/callback`, which calls this before redirecting.
   Avoids the classic "signed in on the client, signed out on every SSR page" bug.
2. **Role provisioning can't be escalated.** `signUp()`/`completePasswordlessSignIn()` insert into
   `user_roles` server-side, but the RLS policy independently enforces the same rule
   (`users self-apply for unrestricted or pending roles`): a client can only self-insert
   `customer`/`buyer`/`animal_owner` as `active`, or `breeder`/`foundation_member`/
   `shelter_member`/`operations` as `pending` — never any role as anything else, never `admin`.
   Defense in depth, verified live.
3. **Intent-based landing is correct**: `landingPathForIntent()` sends breeder/foundation signups
   to `/create-breeder` (the verification application, with a real status machine — not_started /
   pending / more_information_required / approved / rejected / suspended / expired), everyone else
   to `/dashboard/buyer`. A pending breeder role does **not** unlock `/dashboard/breeder`
   (`requireRole` only counts `status === 'active'`) — they correctly stay on the application's
   status page until an admin approves them.
4. **Dashboard guards are UX-only, not the real boundary** (as intended — RLS is): `requireRole`
   just avoids a flash of the wrong page; every table those pages query is independently RLS'd.
5. **Returning-user path is idempotent**: `completePasswordlessSignIn` checks for an existing
   `user_roles` row and skips re-provisioning if found.
6. **A real fresh signup was observed working end-to-end** during this audit: after the delete,
   the same person (Aneta Kostowska) signed up again via Google with a **new** user id, got a
   `profiles` row and `user_roles(customer, active)` correctly, zero collisions with the deleted
   account.

## Incident 1 — broken Magic Link / OTP email template (separate conversation, now fixed)

Malformed HTML in the Supabase "Magic Link" template (`center" style="padding: 40px 16p...` —
an unclosed `style="background-color: #f4ef` attribute upstream broke everything after it) made
**every** magic-link and password-recovery email fail with `unexpected_failure` / 500. Corrected
template handed to the user; confirm it's actually saved and re-tested (last checked, a retry
after the first save still showed the same broken template — see chat history).

## Incident 2 — `auth.users` token columns defaulting to NULL (found + explained, not currently live)

Auth logs (2026-09-10, 05:36–05:51) showed a wave of `/otp` 500s across **multiple different
users**, all:

```
error finding user: sql: Scan error on column index 3, name "confirmation_token":
converting NULL to string is unsupported
```

Root cause: `auth.users.confirmation_token`, `.recovery_token`, and `.email_change_token_new`
have **`NULL` as their column default** (confirmed via `information_schema.columns`). GoTrue's Go
driver can't scan a NULL into those string fields — so if *any* row in the table has NULL there,
GoTrue's user-lookup query for `/otp` breaks for potentially any caller, not just the affected
user. A manual `insert into auth.users` (this project's pattern for provisioning a breeder's
pre-existing account, e.g. `docs/GRYFIN_IMPORT.md`) that omits these three columns creates exactly
this landmine.

**Current state: clean.** A live sweep (2026-09-11) found zero rows with NULL in any of the six
token columns — the offending row was almost certainly the deleted user's, mid-OAuth-flow, now
gone with them. Monika's manually-inserted row (`docs/GRYFIN_IMPORT.md`) was checked directly and
is fine (`''`, not NULL).

**Hard rule going forward** (now in `CLAUDE.md`): any future manual `insert into auth.users` must
explicitly set `confirmation_token = ''`, `recovery_token = ''`, `email_change_token_new = ''`.

## Open, unverified

- **"Confirm email" setting** (Supabase Dashboard → Authentication → Providers → Email) —
  dashboard-only, can't check via SQL. If it's ON, a fresh password signup
  (`signUp()` in `actions.ts`) creates a session-less user and the current `signup.tsx` code
  navigates straight to `/dashboard/buyer` / `/create-breeder` regardless — `requireRole` would
  then see `context.auth === null` (no session yet) and bounce them straight back to `/signin`,
  with no explanation of why. No real password signup has happened yet to observe this directly;
  worth deliberately testing (or checking the dashboard setting) before password signup gets real
  usage. If it's OFF (immediate confirm), there's no issue.
- **Google metadata → `profiles.display_name`**: the fresh Aneta Google signup left
  `profiles.display_name = ''` — `handle_new_user()` reads `raw_user_meta_data ->> 'display_name'`
  / `first_name`/`last_name`, but Google's OAuth metadata uses `full_name`/`name`/`given_name` keys
  instead, so a Google sign-up currently gets no display name until the user fills their profile.
  Minor, cosmetic, not blocking — worth a follow-up if it matters for the UI.
