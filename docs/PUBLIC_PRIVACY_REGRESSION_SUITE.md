# Public privacy regression suite (Stage YR-13)

New `tests/db/public-privacy-regression-suite.test.ts`: a single, reusable, systematic sweep of
every major public-facing read surface as a genuinely anonymous visitor. Consolidates the specific
privacy floor previously proven piecemeal across many other test files into one place — animals,
organisations, `private_addresses`, `transport_requests`' exact addresses, `profiles`' contact
fields, `reports`' reporter identity, `welfare_cases`' internal fields, and `moderation_cases`'
internal decision notes.

## Two fields investigated as suspected leaks, confirmed deliberate instead

While building the sweep, `animals.owner_profile_id` and `profiles.city`/`country`/`display_name`/
`avatar_url` being readable by `anon` initially looked like a real gap — a raw profile id and rough
location exposed on a public listing. Investigated before treating it as a bug (the same
"confirm before fixing" discipline that already caught two wrong fixes earlier this session):

- Two dedicated, well-reasoned migrations exist specifically for this —
  `20260101003100_profiles_anon_public_columns.sql` (`id, display_name, avatar_url`) and
  `20260101003600_profiles_anon_location.sql` (`city, country`), the latter's own comment
  explaining exactly why: private-rehoming listings (an individual's own dog, not an
  organisation's) need a rough public location shown, the same way breeder/foundation listings
  already show their organisation's city/country — and there's no city/country column on `animals`
  itself for the direct-owner case, so it reads from the owner's own profile instead.
- Both grants are deliberately narrow: `email`/`phone` are excluded from `anon`'s grant entirely
  (confirmed live: `information_schema.column_privileges` for `profiles`/`anon` lists exactly
  `avatar_url, city, country, display_name, id` — nothing more).

This is the same intentional pattern any classifieds/marketplace platform uses ("posted by
[Name], [City, Country]") without exposing direct contact details — contact happens through the
app's own gated messaging/application system. Confirmed correct, not changed; the new test asserts
this explicitly (both the public fields' presence *and* the contact fields' continued absence) so
a future change can't accidentally widen it without a test failing.

## One field investigated and left as a judgment call, not "fixed"

`animals.microchip_number` is also in `anon`'s column grant for published listings. Considered
locking it down (a microchip is a permanent physical identifier), but this schema already has a
`missing_or_false_microchip`/`stolen_animal` report reason (`reports.reason` enum) — suggesting the
platform's actual anti-fraud design intentionally allows public chip-number visibility so a
prospective buyer can independently verify it against a national pet-microchip registry and report
a mismatch. Reversing this without product input risks breaking a deliberate anti-fraud feature;
left unchanged and flagged here for whoever owns that product decision, rather than guessed at.

## Verification

- `npx tsc --noEmit`, `npx eslint` — clean.
- New suite: 12/12 passing.
- Full `npm run test:db`: **1001/1001** (+12 from YR-12's 989), verified on a fresh reset plus one
  more run without reset.
- `npm run build`, `npm run db:preflight` (140 migrations, no unsafe patterns) — clean. No
  migration this stage (no schema change — every property tested was already correctly enforced).
