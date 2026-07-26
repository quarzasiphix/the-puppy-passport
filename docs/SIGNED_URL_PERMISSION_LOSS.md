# Signed URL permission-loss safety

Stage XR-5 (append-only queue). Every real signed-URL call site in this app
(`src/lib/queries/{messaging,driver,welfare,transport}.ts`) uses a **300-second (5-minute) TTL**,
generated fresh on demand by the consuming component (a plain `useState`, never cached in React
Query or persisted to a database column — confirmed by reading `src/components/chat-thread.tsx`,
the one real UI consumer, and every query file's own `createSignedUrl(...)` call). This document
states the real, honest residual risk that follows from that design, proven empirically rather
than assumed (`tests/db/signed-url-permission-loss.test.ts`), and which of this stage's 5 named
scenarios are actually reachable in this schema.

## The real residual risk

Supabase Storage signed URLs are self-contained bearer tokens. Once issued, **a signed URL remains
valid until it expires, regardless of what happens to the underlying permission afterward** — RLS
is only re-evaluated at the moment a *new* signed URL is requested, never on each download of one
already issued. Proven directly: a driver creates a signed URL for a real evidence file, their
`driver` role is immediately suspended, and the already-issued URL still returns `200` on a raw
`fetch()` — while any *new* `createSignedUrl()` call from that point on is correctly rejected by
RLS.

**Practical exposure window: up to 5 minutes**, matching the TTL every real call site uses. This is
not a bug and not something application code can eliminate without building real URL-revocation
infrastructure (a server-side blacklist of issued tokens, checked on every Storage read — the
Supabase Storage service has no built-in per-token revocation API to build this on top of). No such
infrastructure exists today, and nothing in this session found a demonstrated need for it: a
5-minute worst-case window between "access should have ended" and "the last possible moment an
already-open browser tab could still load a document" is a small, bounded, honestly-documented
residual risk, not an active vulnerability.

## The 5 named scenarios

| Scenario | Reachable in this schema? | Finding |
|---|---|---|
| **Suspension** | Yes | Proven directly (see above): an already-issued URL survives the suspension; a new one is correctly blocked. The real, honest residual risk this stage documents. |
| **Cancellation** | Yes | Confirmed as **intended behaviour, not a gap**: `transport_requests` cancellation does not revoke the requester's own document access (no `status` condition exists in `transport-documents`' requester-read policy at all) — a customer should still be able to look back at documents they uploaded for their own, now-cancelled request. Proven by test: a fresh signed URL can still be created after cancellation. |
| **Removal** (leaving/being removed from a conversation) | **No** — no reachable mechanism. Confirmed by the same grep this session's own messaging-abuse-controls audit (Stage CJQ) already ran: zero "leave conversation"/"remove participant" call sites anywhere in `src/`. Nothing to test until that feature is built. |
| **Transfer** (organisation ownership) | Not materially distinct from suspension. `kennel-media` access is `owns_org()`-scoped to the *current* `owner_user_id`, read live on every signed-URL request — an ownership transfer is the same "live recheck at request time, already-issued URLs unaffected" shape already proven for suspension. Not duplicated as a third near-identical test. |
| **Dispute** | **No** — no dispute-workflow concept exists anywhere in this schema (confirmed by grep). Nothing to test until one is built. |

## What would actually reduce the exposure window further, if ever needed

Not built this stage (no demonstrated need beyond the honest 5-minute bound already in place):

- A shorter TTL (e.g. 60 seconds) would shrink the window but doesn't eliminate it, and would
  require re-signing more often on slow connections/large files — a real UX tradeoff, not free.
- Real revocation would need a server-side signed-URL issuance log plus a check at Storage's own
  proxy layer, which the platform doesn't expose an API for today.
- The actually-correct mitigation this schema already relies on: never treat a signed URL as a
  long-lived credential — every real call site already regenerates one fresh per view, so the
  worst case is bounded to "whatever was already open in a browser tab in the last 5 minutes,"
  never an indefinitely-reusable link.
