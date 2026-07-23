# Frontend → backend gaps

Every place this frontend session found a real UX limitation that traces back to missing backend
capability, schema, or infrastructure — rather than a frontend bug it could fix directly. Each entry
states what's missing, what the frontend does honestly in the meantime, and what a backend session
would need to add to unblock it. Nothing here was worked around by faking data or inventing a
capability that doesn't exist.

## Data model gaps

### No litter detail page/route
There's no per-litter detail page — `LitterCard`'s "View litter" action used to link to the generic
`/planned-litters` index regardless of which litter was clicked (fixed this session to link to the
litter's kennel profile instead, a real but less specific destination). A genuine per-litter page
would need its own route plus whatever additional litter-specific data a detail view should show
beyond what the card already has (full sibling-puppy list, more photos, etc.) — no schema change
strictly required, just new frontend route + query work once product wants it.

### Litter waiting lists
`LitterCard`'s "Join waiting list" button is honestly disabled with an explanatory tooltip
("coming in a later update — apply once the litter is born"). `mapLitterRow` hardcodes
`waitingList: 0` because no waiting-list table/relationship exists yet. Needs a new table
(litter_id, buyer_id, joined_at or similar) plus RLS — a real schema addition, not attempted here.

### Ratings, review counts, "handovers" count
`mapOrgToBreeder` hardcodes `rating: 0`, `reviewCount: 0`, `handovers: 0` — there's no reviews/
ratings backing table, and no way to count completed handovers per kennel today. The frontend
never fabricates a plausible-looking number here; it's a real, backend-sourced zero. A reviews
feature (and a way to count real completed transports per org) would need new tables plus RLS.

### Reporting an entire community group
`ReportDialog`'s `ReportTargetType` union has `animal_listing`, `organisation`, `post`, `message`,
`user` — no `group` variant. Individual posts *within* a group can already be reported (and this
session added the same control to the main community feed, which didn't have it). Reporting the
group itself (its name/description/moderation, not a specific post) would need a new
`ReportTargetType` value plus whatever the moderation backend does with it — an enum/schema change,
out of bounds for this session.

## RLS / policy-adjacent gaps (not touched, only observed and worked around defensively)

### Owner-preview vs. public detail pages
`getFoundationBySlug` (fixed this session), `getPuppyById` and `getAdoptionById` (also fixed this
session) now all explicitly filter `verification_status`/`is_published` client-side, because RLS's
"owners manage their own X" policies are `for all` (including select) — meaning an org/animal owner
can read their own row through the same query a public visitor uses, even before it's
approved/published, and the public-facing page would render it (and generate its SEO metadata) as
if it were live. The three functions above are now defensively scoped. **Not yet applied** to
`getKennelBySlug`'s breeder-equivalent lookup, `puppies.$id.tsx`'s litter/parent lookups, or
anywhere else following the same "swallow every error into `.catch(() => null)` → `notFound()`"
pattern — those are pre-existing, not introduced by this branch, and fixing all of them consistently
is a larger cleanup than this session's scope. No RLS policy was touched; every fix here is an
additional client-side `.eq()` filter layered on top of whatever RLS already allows.

### Rate limiting / abuse protection
Noted in the backend session's own `docs/FINALISATION_REPORT.md` gap list (per the git log message
"Document rate-limiting/abuse-protection gap found during launch-hardening audit") — not a frontend
concern, mentioned here only so a future reader of this file knows it's already tracked on the
backend side, not missing from this list by oversight.

## Infrastructure gaps

### No image-load-failure fallback
Every mapper function (`mapAnimalToPuppy`, `mapAnimalToAdoption`, `mapOrgToBreeder`,
`mapOrgToFoundation`, `mapLitterRow`) already falls back to a local placeholder image when the
database has **no** image at all. But if a stored image URL is valid in the database yet the actual
file 404s (deleted from storage, a broken migration, etc.), no `<img onError>` handler exists
anywhere in the codebase to swap in the placeholder at render time — this is a real, pre-existing
gap across the whole app, not something this branch introduced. Fixing it means adding an `onError`
handler (and probably a small shared `<AnimalImage>`/`<img>` wrapper component) everywhere an
animal/org image renders — a frontend-only fix in principle, deferred this session because
verifying it actually works needs a real broken-image URL and a real browser, neither available
here.

### No pagination on public list pages
`/find-a-dog`, `/breeders`, `/foundations`, `/adoptions` all load their entire result set
client-side with no pagination or infinite scroll. Fine at today's data volume; a real scalability
concern once the marketplace has hundreds of listings. Needs either a paginated RPC/keyset-based
query shape or a well-considered infinite-scroll design (explicitly *not* the manipulative kind) —
a joint frontend/backend decision, not attempted here.

### SSR is not locale-aware
`src/lib/i18n/index.tsx`'s own header comment already documents this: locale is stored in
`localStorage` only, so a signed-in Polish-preference visitor's very first server-rendered paint is
always English, then re-renders in Polish once the client mounts. Fixing this needs a
locale-preference cookie read server-side (a `createServerFn`/session-adjacent change) — pre-existing,
not introduced by this branch, not attempted here since it touches the auth/session layer this
session was not scoped to change.

### Followed-profile (person) cache keys
`followed-profile-ids` (read by the community feed) and `is-following-profile` (read by the public
profile page) represent the same underlying "who does this user follow" state under two different
keys, with no mutation site invalidating both — the same class of bug this session fixed for
followed *organisations* (`followed-org-ids`/`my-followed-breeders`/`my-followed-foundations`, now
all invalidated together). The person-follow feature predates this branch and wasn't touched by it;
flagged here rather than fixed, to keep this session's diff to what it actually introduced or
directly regressed.

## How to use this file

If a future session (frontend or backend) picks up any of the above, update this file to reflect
what's now real — don't leave a stale "not yet implemented" note once the gap is closed.
