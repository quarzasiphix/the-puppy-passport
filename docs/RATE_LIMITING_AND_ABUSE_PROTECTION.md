# Rate Limiting and Abuse Protection

Written during the Stage J abuse-prevention pass. The gap was first found and documented plainly
during an earlier security-hardening sweep (`docs/FINALISATION_REPORT.md`, "needs external
configuration"): "nothing throttles repeated auth attempts, application/message spam, or API
abuse." This document is the follow-through — what's now actually code-enforced inside this
repository, and what remains genuinely external configuration that only exists outside it.

## What's real, as of this pass

A database-level, per-actor cooldown (`public.rate_limit_events` +
`public.enforce_rate_limit()`, `supabase/migrations/20260101008200_rate_limiting_and_abuse_prevention.sql`
and `20260101008300_rate_limit_key_rpcs.sql`) applied to seven concrete, previously-unprotected
authenticated actions:

| Protected action | Actor key | Dimension | Threshold | Window | Response | Audit event | Recovery |
|---|---|---|---|---|---|---|---|
| Filing a report (`reports` insert) | `auth.uid()` | account | 30 | 1 hour | Insert rejected, plain-language error | none dedicated — the rejected attempt itself is never persisted; only successful reports are auditable via `reports` itself | Wait out the window; an admin has no override today (see "Known limitations" below) |
| Sending a message (`messages` insert) | `auth.uid()` | account | 30 | 1 minute | Insert rejected, plain-language error | same as above | Wait out the window |
| Submitting a welfare case (`welfare_cases` insert) | `auth.uid()` | account | 50 | 1 day | Insert rejected, plain-language error | same as above | Wait out the window; a genuinely urgent case beyond the limit should go through operations directly (messaging/support), not repeated retries |
| Submitting an application (`buyer_applications` insert) | `auth.uid()` | account | 60 | 1 hour | Insert rejected, plain-language error | same as above | Wait out the window |
| Creating a transport draft (`create_transport_draft()`) | `auth.uid()` | account | 100 | 1 hour | RPC raises, plain-language error | same as above | Wait out the window |
| Requesting a transport amendment (`request_transport_amendment()`) | `auth.uid()` | account | 20 | 1 hour | RPC raises, plain-language error | same as above | Wait out the window |
| Inviting an organisation member (`invite_org_member()`) | `auth.uid()` | account | 100 | 1 hour | RPC raises, plain-language error | same as above (plus the normal `org_invitation.created` audit log for *successful* invites) | Wait out the window |

All seven share one mechanism (`enforce_rate_limit(action_key, max_count, window)`): count this
actor's rows in `rate_limit_events` for that `action_key` within the window; if at or over the
threshold, raise a `P0001` exception with a plain, non-alarming message ("You've done this too many
times recently — please wait a bit before trying again.") instead of proceeding; otherwise record
the attempt and continue. `auth.uid() is null` (a direct migration/seed/service connection) is never
rate-limited — there is no real end-user request to protect against in that context.

**Burst behaviour**: none of these are burst-tolerant token buckets — they're plain fixed-count
sliding windows (count actual timestamped rows, not a reset-on-tick counter), which is simpler to
reason about and correctly survives Cloudflare Worker cold starts (a real requirement: an in-memory
counter would silently reset on every new Worker instance and provide no protection at all across
the multiple concurrent instances this app actually runs on — "do not pretend an in-memory
JavaScript map is distributed rate limiting" was a direct instruction for this pass, and using a
real table rather than an in-memory structure is why).

**False-positive recovery**: there is currently no admin "clear this user's rate limit" tool. A
legitimate user who hits a threshold must wait out the window. Given the thresholds chosen are
deliberately generous for real usage (e.g. 30 messages/minute, 60 applications/hour, 100 transport drafts/hour), this is judged
an acceptable gap for now — a dedicated admin override RPC is a reasonable small follow-up, not
included in this pass to avoid scope creep beyond "the abuse-prevention gap" itself.

## What's still genuinely external configuration

The original finding's own framing remains correct for these — nothing in this repository can
implement them, because they operate below or outside the application layer entirely:

| Protected action | Why this repo can't do it | Where it has to be configured |
|---|---|---|
| Repeated sign-in/sign-up/password-reset attempts | Auth happens inside Supabase Auth (GoTrue) before any application code runs | Supabase Auth's own rate-limit settings (dashboard or `supabase/config.toml` `[auth.rate_limit]` for local dev — **not yet configured for production**, since no production Supabase project exists per `docs/PRODUCTION_SETUP.md`) |
| Broad request-volume / DDoS-style abuse against the whole app | Needs to happen at the edge, before a request reaches the Cloudflare Worker | Cloudflare WAF rate-limiting rules on the production zone — **not yet configured**, since no production Cloudflare deployment exists per `docs/DEPLOYMENT_CHECKLIST.md` |
| IP/device-based blocking | This app has no IP address visibility at the database layer (Supabase sees only the Cloudflare Worker's outbound connection, not the original client IP, unless explicitly forwarded and read) | Cloudflare (IP reputation, WAF managed rules) |

Do not read the table above as "these are configured" — they are documented requirements for
whenever a real production Cloudflare/Supabase project is stood up, not claims that they're active
today. No claim of active external rate limiting is made anywhere in this repository's code or
other docs; if you find one, it's stale and should be corrected against this file.

## What was deliberately left unprotected in this pass, and why

- **Document uploads** (`transport_documents`, `welfare_case_documents` via Supabase Storage) —
  Storage objects live outside any Postgres table this migration can attach a trigger to. Real
  protection here needs either a Storage-level policy extension or an edge-function proxy in front
  of uploads; out of scope for this pass, flagged for a future one.
- **Moderation appeals** — already has a real, different protection (one appeal per case, enforced
  by a unique constraint, `20260101007900_moderation_appeals.sql`), which fully prevents the spam
  vector (repeated appeals on the same case) without needing a time-window cooldown on top.
- **Organisation-invitation *acceptance/decline*** — already naturally bounded (single-use tokens,
  one pending invitation per email per org); nothing to add.

## Local verification

`tests/db/rate-limiting.test.ts` exercises the trigger- and RPC-based limits directly against a
real local Supabase instance: confirms the threshold is enforced (Nth+1 attempt within the window
is rejected), confirms it's per-actor (a different user's attempts are unaffected by another user's
count), and confirms the window actually matters (not tested via real wall-clock waiting, which
would make the suite slow and flaky — instead confirms the boundary condition directly against
`rate_limit_events` rows).
