# Havenpaw — Social Login Setup (Google / Facebook)

Google and Facebook sign-in are wired into the sign-in page (`src/routes/_public.signin.tsx`,
calling `supabase.auth.signInWithOAuth`) and declared in `supabase/config.toml`
(`[auth.external.google]` / `[auth.external.facebook]`), but both are `enabled = false` by default.
No credentials are hardcoded anywhere in this repo — until you add real ones, the buttons show a
toast ("Google/Facebook sign-in isn't configured on this server yet") instead of a fake success.

**Important**: signing in with Google or Facebook only proves control of that email address. It
never marks a person as identity-verified, a verified breeder, the legal owner of an animal, an
approved foundation, or an approved transport operator — those stay separate `user_verifications`
rows reviewed by an admin, regardless of how someone signed in.

## Google

1. In [Google Cloud Console](https://console.cloud.google.com/), create (or reuse) a project, then
   go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Authorised redirect URI (local dev, default ports):
   `http://127.0.0.1:54321/auth/v1/callback`
4. Copy the generated **Client ID** and **Client secret**.
5. Add to `.env` (see `.env.example`):
   ```
   SUPABASE_AUTH_GOOGLE_CLIENT_ID=...
   SUPABASE_AUTH_GOOGLE_SECRET=...
   ```
6. In `supabase/config.toml`, set `[auth.external.google] enabled = true`.
7. `npm run db:stop && npm run db:start` to reload the config (or `supabase stop && supabase
   start` directly) — Supabase Auth only re-reads `config.toml` on stack start.

## Facebook

1. In [Meta for Developers](https://developers.facebook.com/), create an app → add the
   **Facebook Login** product.
2. Valid OAuth Redirect URI (local dev, default ports):
   `http://127.0.0.1:54321/auth/v1/callback`
3. Copy the **App ID** and **App secret** from the app's Basic Settings.
4. Add to `.env`:
   ```
   SUPABASE_AUTH_FACEBOOK_CLIENT_ID=...
   SUPABASE_AUTH_FACEBOOK_SECRET=...
   ```
5. In `supabase/config.toml`, set `[auth.external.facebook] enabled = true`.
6. Restart the local stack as above.

## Production

None of the above applies to a production Supabase project — this repo intentionally has no
production Supabase configuration (see `docs/DECISIONS.md`). When a production project exists,
configure the same providers through the Supabase Dashboard's Auth → Providers screen instead of
`config.toml` (which only governs the local CLI stack), using production-appropriate redirect URIs.
