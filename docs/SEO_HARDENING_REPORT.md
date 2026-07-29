# SEO and crawl-control hardening report

## Method

Checked for `public/robots.txt`, any sitemap file or sitemap-generation route, canonical link
tags, and per-page title/description coverage across `src/routes/_public.*.tsx`.

## Fixed (commit `f2b5ad9`)

- **`public/robots.txt`** — didn't exist at all. Added, disallowing `/dashboard/` (every buyer,
  breeder, foundation, driver, operations, and admin route lives under this one prefix — confirmed
  by listing `src/routes/dashboard.*.tsx`, all role-gated by RLS regardless, but there's no reason
  to invite a crawler into an auth wall).

## Deliberately not fabricated

- **No `Sitemap:` line, no `sitemap.xml`, no canonical `<link>` tags.** All three need a real,
  confirmed production domain to generate correct absolute URLs — `docs/PRODUCTION_SETUP.md`
  confirms no production Supabase project or domain is configured yet. Guessing a domain (e.g.
  `havenpaw.com`) would have been actively wrong if the real domain differs or isn't registered.
  This is a real, open gap — not silently skipped, just correctly sequenced behind "a real domain
  exists" rather than invented here.
- A dynamic sitemap (listing every published breeder/foundation/puppy/adoption/litter slug) would
  additionally need a live, populated database to generate and verify against — deferred to
  whenever both the domain and Phase 26's isolated DB verification are available.

## Already correct, confirmed (not new work, spot-checked)

- Per-page `<title>`/`<meta name="description">` via each route's `head()` — confirmed present and
  data-specific (not a generic fallback) on `/planned-routes`, `/foundations/$slug` during
  integration's own Phase 21 browser QA (see `docs/INTEGRATION_FINAL_REPORT.md`); this hardening
  branch inherits that code unchanged.
- Open Graph tags (`og:title`, `og:description`, `og:type`, `twitter:card`) present at the root
  level (`src/routes/__root.tsx`) — confirmed via the raw SSR HTML fetched during integration QA.
- Private routes already excluded from indexing by the new `robots.txt`; no dashboard/admin/
  operations page was ever reachable without authentication regardless (RLS-enforced, not
  robots.txt-dependent for actual protection — this is belt-and-suspenders for crawler noise, not
  the real security boundary).

## Public claim truthfulness (Phase 19)

Spot-checked homepage and `/how-it-works` copy against actual implemented behavior (both files
already reviewed in this session for other reasons — lint fixes on `_public.how-it-works.tsx`,
homepage read during Phase 2 baselining). No claims found that exceed real product behavior:
verification/moderation/transport-safety copy consistently uses qualified language ("professional
schedule of planned journeys — approximate regions and dates only", "Submitting a request does not
guarantee transport or a fixed price") rather than unqualified guarantees. No fake ratings, review
counts, or availability numbers were found — `rating: 0, reviewCount: 0` placeholders in
`cards.tsx`'s `mapOrgToBreeder` are literal zeros (an honestly-unbuilt feature), not fabricated
numbers. A full line-by-line audit of every public route's copy was not performed given the scope
of everything else in this pass; this is a spot check, not exhaustive coverage.
