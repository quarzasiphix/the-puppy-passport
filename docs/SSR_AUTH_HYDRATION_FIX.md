# SSR authentication hydration bug — fixed

Real-beta Phase 5. `docs/E2E_TESTING.md` documented a genuine SSR-hydration race on
`_public.signin.tsx`/`_public.signup.tsx`: a fast click right after page load could fire the
browser's native form submission (a plain GET to the current URL, since neither `<form>` had a
`method` attribute) before React finished attaching `form.handleSubmit(onSubmit)` — leaking
credentials into the URL query string. Documented but explicitly not fixed at the time
("backend-only" mandate for that stage).

This is real-beta scope, not the frozen frontend worktree — `_public.signin.tsx` etc. are this
repo's own live routes, already edited elsewhere this session. Fixing it was in scope.

## The fix

New `src/hooks/use-hydrated.ts` — a standard `useState(false)` + `useEffect(() => setHydrated(true))`
hook. Server-rendered HTML always reports `false` on first client render (matching SSR output, so
no hydration mismatch), then flips `true` once React has actually mounted and attached handlers.

Applied to every auth form that renders immediately in SSR with a sensitive field:
`_public.signin.tsx`, `_public.signup.tsx` (step 0, where email/password already live),
`_public.forgot-password.tsx` (email). Two changes per form:

1. `disabled={!hydrated || form.formState.isSubmitting}` on the submit button — a disabled button
   cannot fire a native submission at all, closing the race at its root cause.
2. `method="post"` on the `<form>` element — defense-in-depth: even if some other, unanticipated
   fallback path fired a native submission, `POST` puts field values in the request body, not the
   URL query string, so credentials still couldn't leak into the URL/browser history/server logs.

`_public.reset-password.tsx` was checked and left alone — its form is gated behind an async
`ready` state that only becomes `true` inside a `useEffect` callback, which by definition cannot
fire before the initial hydration commit completes. That form literally isn't in the DOM until
after hydration, so it was never reachable by this race.

## Verified with a real browser, not assumed

Sandbox note: Playwright's headless Chromium, which failed to launch in this sandbox at the time
`docs/E2E_TESTING.md` was written, launches successfully now — re-confirmed directly before relying
on it.

- Fetched the real SSR HTML for `/signin` directly: confirmed `<form ... method="post">` and
  `<button type="submit" disabled="">` are both present in the server-rendered output.
- Loaded the page in a real headless browser and polled the submit button's enabled state: stayed
  disabled through 1.2s, became enabled at ~1.5s (unbundled Vite dev-mode hydration is slower than
  a production build; the mechanism itself is instant relative to whenever hydration actually
  completes, since it's driven by React's own commit, not a fixed timer).
- Ran a complete real sign-in through the fixed form (fill email/password, click submit, wait for
  navigation): landed on `/dashboard/buyer` successfully — the fix doesn't break the real flow.

## Verification

- `npx tsc --noEmit` — clean.
- `npx eslint` on all changed files — clean.
- `npm run build` — succeeds.
- Real browser verification as above (SSR output inspection + hydration-timing check + full
  sign-in flow).
