# Bot 1 — Final Backend Certification (Domain P/Q)

**Certified HEAD**: `54b06d79bdaec4c44ea8947bf20e9585108bc2aa`. Real backend's current tip at time
of writing: `54846e0036c117eec5078cfa41ffb95dc6e803bf` — one further commit,
`docs/CURRENT_RELEASE_STATUS.md`, added by Bot 2 itself, titled **"Freeze main for Bot 1 final
certification"**, explicitly declaring `main` frozen at `54b06d79` pending this exact certification.
Read in full — its own claimed state (test counts, toolchain results, migration count) was **not
trusted and was independently re-derived from scratch in a fresh isolated clone**, matching every
number it claims. HEAD re-checked twice after this document appeared, separated by real elapsed
time, both times stable and clean — the second of the "2+ consecutive checks" this pass's own
standing discipline requires.

## Method

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

## Results (three consecutive clean runs — the "twice + third stateful" requirement satisfied in
## one consistent settled sequence, after the settling period above)

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

**GO.** Every condition the task's own decision model requires is met against this exact certified
HEAD: final quiet HEAD confirmed stable across 2+ real-time-separated checks (`54846e0`, itself a
docs-only commit atop the certified `54b06d79`); zero Critical; zero unaccepted High; fresh reset
(via documented manual recovery) passes; repeated full suite passes (3 consecutive clean runs after
settling); TypeScript passes; build passes; unique migration prefixes; preflight clean; contract
check clean; grants/RLS/`SECURITY DEFINER`/Storage all independently verified at 100% coverage for
their respective inventories. Lint is honestly reported as not-clean (pre-existing, unchanged,
non-functional) rather than glossed over.

**This decision is issued for `54b06d79bdaec4c44ea8947bf20e9585108bc2aa` specifically.** The one
further commit (`54846e0`) is documentation-only and does not require re-certification, but should
be noted as the actual current tip in any downstream reference to "certified main."
