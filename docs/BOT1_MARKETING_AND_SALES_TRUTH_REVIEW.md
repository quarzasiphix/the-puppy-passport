# Bot 1 — Marketing and Sales Truth Review

One row per marketing/sales requirement (VA-15, VA-18, VA-37..VA-43). Source snapshot `ac612690`.

| Requirement | Status | Evidence |
|---|---|---|
| Analytics privacy-safe | N/A — confirmed absent | 0/72 deps match any analytics provider signature; no event pipeline exists to audit |
| Lead capture / CRM privacy-safe & minimised | N/A — confirmed absent | No CRM/lead-capture integration in manifest or schema |
| Sales claims match product truth | Unverified this pass | No sales collateral exists in the repository to check against the product — consistent with Domain U being unstarted |
| Onboarding reproducible from docs alone | Unverified this pass | `docs/LOCAL_SETUP.md` covers *developer* setup, not *organisation onboarding* (a distinct product flow); not independently re-driven |
| Customer success metrics not fabricated | Confirmed clean | No such metrics section exists to fabricate values in |
| Demo/product-tour truth | Unverified this pass | No live browser/tour run performed |
| Landing-page claims vs. working capability | Unverified this pass | Overlaps Domain D (public marketplace contract), not independently re-driven this pass |
| SEO readiness (titles/descriptions/canonical/robots/sitemap/structured data) | **Real finding — SEO-1 (Low)** | See detail below |
| Performance claims not overstated from local-only tests | Confirmed clean | No production performance claim found anywhere to flag |
| Polish-language copy quality (critical flows) | Unverified this pass | Not reached |

**Summary**: nothing to correct — no false marketing/sales claim exists anywhere in the repository,
because essentially no marketing/sales surface exists yet (consistent across every independent Bot 1
pass in this lineage).

## SEO-1 (Low) — dynamic title/description real; canonical/robots/sitemap/structured-data absent

**Evidence** (this pass, code read, no browser needed — TanStack Router `head()` route option is
plain source code): 30 public route files under `src/routes/_public.*.tsx` define a real `head:
(...) => ({ meta: [...] })` function. Sampled `_public.puppies.$id.tsx` and
`_public.breeders.$slug.tsx`: both build **dynamic** `<title>` and `<meta name="description">` from
real `loaderData` (e.g. `"${loaderData.puppy.name} — ${loaderData.puppy.breed} — Havenpaw"`), not
static placeholder text — a genuine positive: the metadata is not fake/hardcoded. `__root.tsx` also
sets a default `head()` for the fallback case.

However: `grep -rn "rel.*canonical"` across `src/` finds zero canonical `<link>` tags anywhere;
`grep -rn "noindex"` finds zero robots meta tags; `find . -iname "robots*" -o -iname "sitemap*"`
finds no `robots.txt` or `sitemap.xml` anywhere in the repo. No `application/ld+json`/`schema.org`
structured data exists on any route.

**Impact**: Low, not launch-blocking. Once the marketplace has real traffic and the
filterable/paginated listing surfaces documented in the lineage's Domain D coverage are live, the
absence of canonical URLs is a real duplicate-content/crawl-budget risk (e.g. the same puppy
reachable via multiple filter-parameter combinations with no canonical pointer back to one URL), and
the absence of `robots.txt`/sitemap makes crawl discovery slower than necessary. Not a security or
privacy issue. Smallest fix: add a canonical `<link>` in each detail-route `head()` pointing at the
un-parameterized URL, and a static `robots.txt`/generated `sitemap.xml` — no migration or RLS
involvement, frontend-only, safe for Bot 2 or a future frontend pass to pick up independent of the
5 open High findings.
