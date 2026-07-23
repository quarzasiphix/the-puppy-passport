# Frontend observability contract

Defines what gets reported when the frontend fails, and — just as importantly — what must never be
logged. No paid monitoring provider is integrated or proposed here; the only reporting mechanism
that exists is the platform-provided `window.__lovableEvents.captureException` hook already wired
in `src/lib/lovable-error-reporting.ts` and called from `src/routes/__root.tsx`'s root error
boundary. This document describes that existing contract and extends it to the failure classes it
doesn't yet cover — it does not propose adding a new SDK or dependency.

## Failure classes and current handling

| Failure class | Current handling | Safe user-facing message | Reported via `reportLovableError`? |
|---|---|---|---|
| Route loader error (uncaught) | Root `ErrorComponent` (`__root.tsx`) | "This page didn't load. Something went wrong on our end. You can try refreshing or head back home." | Yes — the only call site today |
| `useQuery` error | Per-page `isError` branch → `<ErrorState>` | Page-specific honest copy ("Couldn't load your applications…"), always with a retry action | No — caught locally, not re-thrown to the root boundary. Acceptable: these are handled, expected, retryable failures, not the "something crashed" case the root boundary exists for |
| `useMutation` error | `onError` → `toast.error(...)` | Always a generic-or-specific-but-safe message (see the raw-Postgres-error fix this session in `create-breeder.tsx`/`dashboard.buyer.profile.tsx`) | No — same reasoning as query errors |
| Broken image | `<AnimalImage>`'s `onError` swap to placeholder | Silent (no toast) — a missing photo isn't an error worth interrupting the user for | No |
| `notFound()` | Root `notFoundComponent` | Distinct "not found" page copy | No — not a bug, an expected state |

## What to log vs. what to show

- **Route-loader/render crashes** (the "root boundary" row above) are genuine unexpected failures —
  worth reporting via `reportLovableError` so they're visible to whoever monitors the Lovable
  platform's error stream, with the route path as context (already included:
  `route: window.location.pathname`).
- **Query/mutation errors** are already anticipated and handled per-page with a specific, honest UI
  state (loading → error → empty → populated, per `docs/FRONTEND_DESIGN_SYSTEM.md`) — these are not
  re-reported to `reportLovableError` today, and that's an intentional distinction: re-reporting
  every expected, user-recoverable failure (e.g. "no network for two seconds") would flood whatever
  reads the Lovable error stream with noise that isn't actionable. If a future session wants
  aggregate visibility into how often a given query fails, that's a product decision (do we want a
  "query failed" event class in the analytics contract, see `FRONTEND_ANALYTICS_EVENTS.md`) — not an
  error-reporting change.

## Fields that must never be logged or reported (to `reportLovableError`, `console`, or any future
provider)

- Access/refresh tokens, session cookies.
- Private message content (`messages`/`conversation_participants` bodies).
- Exact addresses (`pickup_address_exact`, `destination_address_exact`, any `street_address`-shaped
  field).
- Application answers (`buyer_applications` free-text fields).
- Uploaded document paths/filenames (health documents, verification documents).
- Personal contact details (email, phone) beyond what's already visible to the signed-in user
  themselves.

None of these are currently logged anywhere in the frontend (verified by grep across every touched
file this session for `console.log`/`console.debug` — zero hits outside `console.error` on caught
exceptions, and `reportLovableError`'s only context field is the route path). This section exists so
a future session extending error reporting doesn't accidentally add one of these fields to a context
object.

## `console.error` usage

The root `ErrorComponent` calls `console.error(error)` before reporting — acceptable, since this is
a genuine unexpected crash and `console.error` in production only reaches the browser devtools
console of the affected user's own session, not a shared log. No other `console.*` calls exist in
the files this branch touched.
