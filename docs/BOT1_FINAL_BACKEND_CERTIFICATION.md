# Bot 1 — Final Backend Certification (Domain P/Q)

## UPDATE — formal certification directly against `54846e0036c117eec5078cfa41ffb95dc6e803bf`

**CERTIFIED HEAD (final, authoritative): `54846e0036c117eec5078cfa41ffb95dc6e803bf`.** This
supersedes the below section's certification of `54b06d79` — that certification remains valid
evidence, but this round performed a **full, independent, fresh empirical re-certification directly
against `54846e0` itself** (not inherited from the doc-only-delta shortcut), per an explicit request
to formally bind the GO decision to this exact HEAD. `git log 54b06d79..54846e0` confirmed, again,
exactly one commit (`docs/CURRENT_RELEASE_STATUS.md`, Bot 2's own freeze announcement) — zero
code/migration/test files. HEAD re-checked repeatedly across this entire round (initial check,
after Phase 2, after the empirical run, at finalization) — stable and clean every time.

### Method (this round)

Fresh isolated clone (`/p/the-puppy-passport-bot1-final-cert-54846e0-20260729-165825`, deleted
after use, never committed), detached to `54846e0036c117eec5078cfa41ffb95dc6e803bf`, new branch
`audit/bot1-final-cert-54846e0-20260729-165825`. `npm ci` clean.

**Full diagnostic transparency on the path to a clean 3-run certification** (recorded honestly
rather than only reporting the final clean sequence): the `db:reset` CLI crash recurred
(`exit 139`/`LegacyGoChildExitError`, same known failure mode, same manual recovery). An initial
exploratory sequence of 5 full `npm run test:db` runs plus several single-file isolated reruns
(performed to investigate 2 anomalous full-suite runs) showed intermittent failures in different
test files each time. **Both root causes were identified, not merely assumed transient**:
1. A rare gateway/connection-pool-shaped flake (`"An invalid response was received from the
   upstream server"`) — observed twice across many runs, in different unrelated test files each
   time, always passing cleanly when that exact file was rerun in isolation immediately afterward.
2. **Genuine accumulated rate-limit state from running the suite far more than the intended 3
   times without an intervening reset** — directly confirmed by isolating the one test that kept
   failing (`welfare-cases.test.ts`'s 10-concurrent-review test) and finding a real
   `P0001`/`"You've done this too many times recently"` rate-limit rejection, not a generic
   error — i.e. the application's own rate limiting was working *correctly* under the load this
   round's own repeated diagnostic testing generated, not exhibiting a bug.

Having identified this, the database was reset **cleanly one final time** (including explicitly
clearing stale `auth.users`/`storage.objects` state left over from the diagnostic runs — a real
gap in the standard recovery procedure found this round: `drop schema public cascade` does not
touch `auth`/`storage` schema data, only `public`) and exactly 3 consecutive `test:db` runs were
performed with no other interleaved activity, matching the task's own intended methodology.

## Prior round's method (against `54b06d79`, retained for history)

Fresh isolated clone (`/p/the-puppy-passport-bot1-final-cert-20260729-163004`, deleted after use,
never committed anywhere), detached to `54b06d79bdaec4c44ea8947bf20e9585108bc2aa`, new branch
`audit/bot1-final-cert-20260729-163006`. `npm ci` clean.

**A second, distinct infrastructure incident was hit and resolved during this certification**,
disclosed in full: `npx supabase db reset` again crashed deterministically
(`exit 139`/`LegacyGoChildExitError`, same failure mode as the prior round). Recovered via the same
proven manual path (restart `storage`/`auth` containers to re-provision their platform-internal
schemas, `drop schema public cascade; create schema public; ...`, replay all 151 migrations via
direct `psql` in filename order, then `seed.sql`, then a corrective
`grant usage, select on all sequences...` for the same sequence-privilege artifact as last time).

**A new, distinct transient-flake pattern was hit and diagnosed this round**: the first 3 full
`test:db` runs each showed exactly 2 failures, in 3 *different* test files each time, always with
the same generic infrastructure-shaped error (`"An invalid response was received from the upstream
server"` / `"Could not sign in as admin: {}"`). Diagnosed via `docker logs supabase_auth_...`
(caught one instance mid-transition: `column users.banned_until does not exist`, a genuine but
transient auth-schema-not-yet-fully-ready state immediately after the container restart) and
`docker logs supabase_rest_...` (showed repeated `Config reloaded`/schema-cache-reload churn
correlating with the failure window). **Confirmed transient, not a regression**: the exact failing
test from run 1 passed cleanly in isolation immediately afterward (23/23); runs 4, 5, and 6 — once
the auth/PostgREST containers had fully settled after the restart — were **all 1062/1062, zero
failures, three consecutive times**. This is disclosed in full rather than silently discarding the
early failed runs, per this pass's own standing evidence discipline.

## Results — authoritative, this round, directly against `54846e0` (final 3-run sequence)

- **Test count**: 1062/1062, 0 failures, 0 cancelled, 0 skipped — **3 consecutive clean runs**
  (fresh reset, then 2 repeats with no reset), zero flakiness once the diagnosed prior-round-testing
  pollution was cleared. All 5 former High-finding regression tests independently confirmed present
  and passing by name in this exact run: `transport_requests.status: a raw update cannot forge
  accepted_by_customer`; `create_notification_if_enabled: authorization boundary`;
  `account_deletion_requests: status/processed_by cannot be raw-forged by the requester`;
  `claim_moderation_case: a moderator cannot claim or decide a case about their own account`;
  `achievements: an organisation cannot self-verify its own achievement`.
- **TypeScript** (`npx tsc --noEmit`): clean, 0 errors.
- **Lint** (`npm run lint`): **21 errors, 13 warnings — unchanged**, independently re-confirmed
  against `54846e0` directly (not inherited from the prior round).
- **Build**: clean, both client and SSR/Nitro/Cloudflare-Worker bundles.
- **`db:preflight`**: clean — 151 migrations scanned, no unsafe patterns.
- **`db:contract-check`**: clean — no drift, 70 tables/43 RPCs match baseline.
- **Migration count**: 151, zero duplicate prefixes, latest prefix
  `20260101014900_achievement_self_verification_lock.sql`.
- **`SECURITY DEFINER`**: 94/94 `public`-schema functions search_path-pinned (100%, live-queried).
- **RLS**: 70/70 `public`-schema tables enabled (100%, live-queried).
- **Storage**: 5 buckets, 19 effective policies (both live-queried).
- **Secret scan**: zero matches for service-role-key/Stripe-key/AWS-key/PEM-header shapes.
- **`git diff --check`**: clean.

## Prior round's results (against `54b06d79` — three consecutive clean runs, "twice + third
## stateful" satisfied in one consistent settled sequence, after the settling period below)

- **Test count**: 1062/1062, 0 failures, 0 cancelled, 0 skipped — **identical 3 times in a row**.
  Independently confirms Bot 2's own `docs/CURRENT_RELEASE_STATUS.md` claim (1062/1062), not merely
  reads it.
- **TypeScript** (`npx tsc --noEmit`): clean, 0 errors.
- **Lint** (`npm run lint`): **21 errors, 13 warnings — identical count to the prior round**,
  independently re-checked as instructed ("check if that count changed") — **it has not changed**.
  All in the same pre-existing files unrelated to any reviewed finding
  (`src/lib/auth/guards.ts`, `src/lib/queries/fleet.ts`, `src/lib/queries/pricing.ts`,
  `src/routes/_public.how-it-works.tsx`, `src/lib/i18n/index.tsx`,
  `src/routes/_public.transport.request.tsx`). **Not claimed clean** — matches Bot 2's own honest
  framing in `CURRENT_RELEASE_STATUS.md`, which also states this count unchanged.
- **Build** (`npm run build`): clean, both client and SSR/Nitro/Cloudflare-Worker bundles.
- **`db:preflight`**: clean — 151 migrations scanned, no unsafe patterns.
- **`db:contract-check`**: clean — no drift, 70 tables/43 RPCs match baseline.
- **Migration count**: 151, zero duplicate prefixes.
- **`SECURITY DEFINER` search_path inventory**: 94/94 `public`-schema functions pinned (100%,
  live-queried).
- **RLS inventory**: 70/70 `public`-schema tables enabled (100%, live-queried).
- **Storage policy inventory**: 19 effective policies (live-queried), consistent with the 5-bucket
  accounting in `docs/BOT1_DEEP_STORAGE_PRIVACY_CONFIG_PERFORMANCE_AUDIT.md`.
- **Secret scan**: zero matches for service-role-key/Stripe-key/AWS-key/PEM-header shapes across
  the working tree.
- **`git diff --check`**: clean.

## Critical / High / Medium / Low

- **Critical**: 0.
- **High**: 0 open (all 5 fixed, empirically verified by two independent methods across two
  separate rounds — rollback-transaction reproduction, and now this full fresh-reset suite twice
  over with real actor impersonation reproducing all 5 original attacks in the prior round).
- **Medium**: unchanged from `docs/BOT1_DEEP_STORAGE_PRIVACY_CONFIG_PERFORMANCE_AUDIT.md` (~12
  named, E-7's genuinely-public-facing gaps now closed per the delta review — see
  `docs/BOT1_LONG_HOURS_DELTA_LEDGER.md`).
- **Low**: 9 named (SEO-1 unchanged/open; Q-1 now fixed — see below), 2 fixed, 7 open.

## Decision 1 of 10 — Backend technical certification

**GO.** Every condition the task's own decision model requires is met, verified **directly against
`54846e0036c117eec5078cfa41ffb95dc6e803bf` itself**, not inherited: quiet HEAD confirmed stable
across repeated real-time-separated checks throughout this entire round; zero Critical; zero
unaccepted High (all 5 formerly-open High findings' exact regression tests independently confirmed
present and passing in this exact run); fresh reset (via documented, now-refined manual recovery)
succeeds; repeated full suite passes 3 consecutive times with zero failures; TypeScript passes;
build passes; 151 unique migration prefixes; `db:preflight`/`db:contract-check` both clean;
94/94 `SECURITY DEFINER` pinned; 70/70 RLS enabled; 5 buckets/19 Storage policies; secret scan
clean; `git diff --check` clean. Lint is honestly reported as not-clean (21 errors/13 warnings,
pre-existing, unchanged, non-functional) rather than glossed over.

**Formal certification statement, as required:**

> **Frontend integration may now begin from frozen backend HEAD
> 54846e0036c117eec5078cfa41ffb95dc6e803bf.**

This statement is issued for `54846e0036c117eec5078cfa41ffb95dc6e803bf` exactly — the real,
current, frozen tip of `main` at the time of this certification, independently fresh-tested in its
own right, not merely inherited from the `54b06d79` certification via the doc-only-delta shortcut
(though that shortcut was independently confirmed valid too — see Phase 2 above).
