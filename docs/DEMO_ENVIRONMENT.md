# Demo environment

Real-beta Phase L. Checked before building anything — `supabase/seed.sql` (loaded by every
`npm run db:reset`) already provides a substantial, real demo dataset.

## What already exists (verified by direct inspection, not assumed)

`seed.sql` populates: organisations (Cichy Las Kennel, Wolna Dolina, Fundacja Ratunek dla Psów —
see `docs/LOCAL_SETUP.md`'s own demo-accounts table), animals, litters, parent dogs, breeds, buyer
applications, reservations, quotations, a full transport chain (requests, parties, animals, status
history, routes, route assignments), drivers, vehicles, user roles, and user verifications. This is
already a genuinely usable product tour for marketplace discovery, breeder/foundation profiles,
buyer applications, and transport — not a thin stub.

## Real, bounded gap: no moderation, messaging, or achievement demo data

Direct grep confirms `seed.sql` has zero rows for `moderation_cases`, `messages`/`conversations`,
`achievements`, or community `posts`. Anyone touring the moderation dashboard or messaging UI today
starts from a genuinely empty state.

## Why this isn't fixed in this same pass

`seed.sql` is not a demo-only fixture — it's the shared baseline every one of this session's 1062
DB/API tests resets against. Adding rows to it carries real risk: a new moderation case or
conversation could collide with a test's own assumption ("no existing case for this profile," a
count-based assertion, a dedup-key collision) in a way that would only surface by actually running
the full suite and finding out — not something to add casually in the same breath as everything
else covered in this pass.

**The right shape for this, not built here**: a _separate_, on-demand demo-augmentation script
(run only when explicitly requested, never as part of `db:reset`/`test:db`) that layers a handful
of moderation cases, conversations, and achievements on top of the existing seeded personas — with
its own guard refusing to run against anything that looks production-like (matching the same
principle `docs/BETA_SCOPE.md` and `docs/ENVIRONMENT_SEPARATION.md`-equivalent content already
establish elsewhere). Flagged as a concrete, well-scoped next task, not spread thin across this
already-large pass.

## Product tour, using what's real today

1. Sign in as `buyer@havenpaw.test` → browse `/find-a-dog`, view a real animal detail page, view a
   real breeder profile.
2. Sign in as `breeder1@havenpaw.test` → real dashboard with real litters/puppies/applications.
3. Sign in as `ops@havenpaw.test` → real transport dispatch, routes, vehicles, drivers.
4. Sign in as `admin@havenpaw.test` → real verification queues, audit logs.

Moderation and messaging can be demonstrated by _creating_ a real case/conversation live during the
tour (both are fully real, tested features — just starting from an empty table, not a broken one).

## Production guard

Not applicable yet in the sense of "a script that could accidentally run against production" —
no production Supabase project exists (`docs/PRODUCTION_SETUP.md`), so there's currently nothing
for a demo-reset command to accidentally damage. This becomes a real requirement the moment a
production project exists, not before.
