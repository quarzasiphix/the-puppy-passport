# Anemalo — Social Login Setup (Google)

Status (updated 2026-09-09): **Google sign-in is live in production** — configured directly in the
Supabase Dashboard (Auth → Providers) for the real `anemalo` project (`pgzvkkybqrhxedjoyjzy`), not
via `supabase/config.toml` (which only ever governed the local CLI stack — see "Local development"
below). The sign-in page (`src/routes/_public/signin.tsx`) leads with a full-width "Continue with
Google" button; email/password stays available below a divider as the fallback.

**Facebook was removed from the UI 2026-09-09** — it was never actually configured (no real
credentials, anywhere), so the button always produced a "not configured" error. Re-adding it is
straightforward whenever real Facebook App credentials exist: the same `signInWithOAuth({
provider: "facebook", options: { redirectTo: ... } })` call `onGoogleSignIn` in `signin.tsx` makes
for Google works unchanged for any other Supabase-supported provider — add the button, point
`provider` at the new one, configure it in the Supabase Dashboard, done.

**Important**, unchanged: signing in with Google only proves control of that email address. It
never marks a person as identity-verified, a verified breeder, the legal owner of an animal, an
approved foundation, or an approved transport operator — those stay separate `user_verifications`
rows reviewed by an admin, regardless of how someone signed in.

## How the OAuth round trip actually works here

This matters because it's the part that's easy to get wrong with `@supabase/ssr`'s cookie-based
session model, and was the actual gap this pass fixed:

1. `signin.tsx`'s `onGoogleSignIn()` calls the **browser** client's `signInWithOAuth({ provider:
   "google", options: { redirectTo: "<origin>/auth/callback" } })` — this only ever *starts* the
   redirect to Google. It cannot create a session itself.
2. Google redirects back to `/auth/callback?code=...` (or `?error=...` on failure/cancellation).
3. `src/routes/auth.callback.tsx` — a bare route with no site chrome — reads that `code` and calls
   the new `exchangeOAuthCode` server function (`src/domains/identity/services/actions.ts`), which
   runs `supabase.auth.exchangeCodeForSession(code)` through `getSupabaseServerClient()`. This is
   the part that must happen **server-side**: only the server client's cookie-aware `setAll` can put
   the resulting session into cookies that SSR route loaders and `getCurrentUser()` actually read.
   A client-side-only exchange would leave the browser looking signed in while every
   server-rendered page still saw no session — the classic split-brain bug this route exists to
   avoid.
4. On success, redirects to `/dashboard/buyer`; on failure, redirects to `/signin?oauthError=...`,
   which surfaces the real error via a toast (previously this always showed a generic hardcoded
   "isn't configured" message regardless of the actual failure — fixed the same pass).

**Required Supabase Dashboard step this app can't do for you**: `<production site origin>/auth/
callback` must be in the project's Auth → URL Configuration → **Redirect URLs** allow-list, or
Supabase rejects the redirect before it ever reaches this route.

## Local development

Google/Facebook are also declared in `supabase/config.toml` (`[auth.external.google]` /
`[auth.external.facebook]`, both still `enabled = false` by default) for running against the
**local** CLI stack — unrelated to the production Dashboard configuration above, and not touched by
this pass. To enable one locally:

1. In [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials →
   Create Credentials → OAuth client ID → **Web application**.
2. Authorised redirect URI (local dev, default ports):
   `http://127.0.0.1:54321/auth/v1/callback`
3. Add the generated Client ID/secret to `.env` (see `.env.example`):
   ```
   SUPABASE_AUTH_GOOGLE_CLIENT_ID=...
   SUPABASE_AUTH_GOOGLE_SECRET=...
   ```
4. Set `[auth.external.google] enabled = true` in `supabase/config.toml`.
5. `npm run db:stop && npm run db:start` (Supabase Auth only re-reads `config.toml` on stack start).
