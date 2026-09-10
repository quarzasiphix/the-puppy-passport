# Breeder-site SDK + media protocol

Status: **plan, 2026-09-11.** Nothing here is built. Prereq context:
`docs/API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md` (the gateway), `docs/STORAGE_AND_MEDIA.md` (R2
strategy), `docs/GRYFIN_IMPORT.md` (breeder #1). The `/p/grif/p` `anemalo-gateway` branch is the
working proof that a breeder site can run entirely off `api.anemalo.com` — this doc turns that
one-off into a repeatable, packaged thing so **"add a breeder → hand them a custom site" is a
runbook, not a project.**

Three deliverables, in dependency order:

1. **Media protocol** — one canonical way media is stored, addressed, and resolved to a URL, so
   sites (and the SDK) never hardcode a CDN host.
2. **`@anemalo/site-sdk`** — the typed client + mappers + media resolver, extracted from
   `/p/grif/p` so the next site is `npm i` + config, not copy-paste.
3. **Onboarding runbook + a template repo** — the concrete steps and the scaffold.

---

## Part A — Media protocol

### A.1 Where things stand

| Surface | Column | Value today |
|---|---|---|
| puppy photos | `animal_images.image_url` | absolute `https://media.hodowlagryfinyork.pl/puppies/<uuid>.webp` (imported as-is) |
| breeding-stock photo | `parent_dogs.profile_image_url` | absolute `https://media.hodowlagryfinyork.pl/dogs/<uuid>.webp` |
| pedigree identity photo | `dogs.profile_image_url` | (mirrors `parent_dogs` via the identity trigger) |
| kennel logo / cover | `organisations.logo_url` / `cover_image_url` | seed data uses relative `/images/seed/...`; no real upload UI yet |
| community posts | `post_media` | `post-media` bucket, no upload UI yet |

`media.hodowlagryfinyork.pl` is a Cloudflare custom domain in front of the R2 bucket
`gryfinyork-media`. The bucket objects live at keys `dogs/<uuid>.<ext>` and `puppies/<uuid>.<ext>`.
Verified 2026-09-11: `GET` on those URLs returns `200 image/webp` (the worker in front rejects
`HEAD` — GET only). `media.anemalo.com` does **not** resolve yet.

Decided in `STORAGE_AND_MEDIA.md` (2026-09-10): **reuse `gryfinyork-media` as Anemalo's media
bucket**, front it with `media.anemalo.com`, no object copy, namespace *future* uploads under
`org/<organisation_id>/…`.

### A.2 The rule: store a **path**, resolve with a **base**

Rows store a portable **media path** relative to a bucket root — never an absolute URL, never a
CDN host. A URL is produced at read time as `<media base> + "/" + <path>`.

- **Canonical media base** (platform default): `https://media.anemalo.com`.
- **Per-org override**: `organisation_site_configurations.media_base_url` (nullable text). When
  set, the gateway resolves that org's media against it instead of the platform default. This is
  how GRYFIN's *own* site keeps serving `https://media.hodowlagryfinyork.pl/...` (her branding, her
  domain) while `anemalo.com` and her `@handle` profile serve the identical bytes from
  `https://media.anemalo.com/...` — same bucket, two CNAMEs.
- Paths for existing GRYFIN objects stay `dogs/<uuid>.<ext>` / `puppies/<uuid>.<ext>` (no object
  move). New uploads get `org/<organisation_id>/<kind>/<uuid>.<ext>`.

**Why not a `media_assets` table.** A first-class `media_assets(id, org_id, storage_key, kind,
content_type, width, height, blurhash, created_by, created_at)` with FK references is the "right"
long-term model (dedupe, dimensions for `<img width height>`, one delete path, EXIF stripping
audit). It's also a much bigger migration touching every image-bearing table + every write path +
RLS. **Defer it.** The path+base rule below is forward-compatible: a `media_assets` row's public
projection is just `{ path: storage_key, ... }`, so the gateway/SDK contract doesn't change when
it lands.

### A.3 Schema change (additive, one migration — *not yet applied*)

```
-- per-org CDN base (null ⇒ platform default https://media.anemalo.com)
alter table public.organisation_site_configurations
  add column media_base_url text;

-- portable paths alongside the existing absolute columns; keep both during transition
alter table public.animal_images add column image_path text;
alter table public.parent_dogs   add column profile_image_path text;
alter table public.dogs          add column profile_image_path text;
alter table public.organisations  add column logo_path text, add column cover_image_path text;
```

Backfill (GRYFIN only; every other org has no real media yet):

```
update public.animal_images
   set image_path = regexp_replace(image_url, '^https?://media\.hodowlagryfinyork\.pl/', '')
 where image_url like 'https://media.hodowlagryfinyork.pl/%';

update public.parent_dogs
   set profile_image_path = regexp_replace(profile_image_url, '^https?://media\.hodowlagryfinyork\.pl/', '')
 where profile_image_url like 'https://media.hodowlagryfinyork.pl/%';
-- dogs.profile_image_path: same, or re-derive from parent_dogs via dog_id.

update public.organisation_site_configurations
   set media_base_url = 'https://media.hodowlagryfinyork.pl'
 where organisation_id = '2dce98c9-f5b9-4df9-9243-9239adc290dd';  -- GRYFIN YORK
```

`image_url` stays populated and correct throughout — nothing breaks if this migration lands before
the gateway/SDK learn about `*_path`. The absolute columns become derived (or dropped) only once
every reader goes through the SDK.

### A.4 Gateway changes

`/v1/site-content` gains, for every media-bearing row, **both** a `path` and a resolved `url`:

```jsonc
// animal_images entry
{ "path": "puppies/0ed3ae25-….webp",
  "url":  "https://media.hodowlagryfinyork.pl/puppies/0ed3ae25-….webp" }  // base from site config
```

- Resolution order: `site config media_base_url` → env `MEDIA_BASE_URL` → `https://media.anemalo.com`.
- `url` is a convenience for dumb clients; `path` is the contract. Old clients that only read
  `image_url`-style absolute URLs keep working because `url` is exactly that.
- No new endpoint. `public_parent_dogs` / `public_dogs` / `animal_images` selects add the
  `*_path` columns; the Worker does the string join.

### A.5 Go-forward upload path (breeder panel → R2)

Unchanged from `STORAGE_AND_MEDIA.md`'s plan, stated here as the protocol the SDK assumes:

1. Breeder uploads in the **Anemalo breeder panel** (single source of truth — `/p/grif/c` is
   retired for GRYFIN, see `GRYFIN_IMPORT.md`).
2. Client compresses / HEIC-converts, then `POST`s to an **`upload-media` Supabase Edge Function**
   (mirrors `/p/grif/c`'s `upload-media` + `media-worker/`), authenticated with the caller's
   Supabase `access_token`. The function verifies `is_org_member(org)`, writes the object to
   `gryfinyork-media` at key `org/<org_id>/<kind>/<uuid>.<ext>`, returns `{ path }`.
3. The panel stores `path` in `*_path`. The public URL is only ever computed on read (A.4).
4. Delete = the function removes the object + the row nulls `*_path`.

R2 credentials live only in that function / its worker binding — never in a browser bundle, never
in the gateway (`gateway/wrangler.toml` stays anon-key-only).

---

## Part B — `@anemalo/site-sdk`

### B.1 Packages

Two, published from a new repo `anemalo-sdk` (sibling of `app/` and `gateway/`):

| Package | Contents | Depends on |
|---|---|---|
| `@anemalo/api-contract` | TypeScript types for every `/v1` response + the request payloads. Hand-maintained mirror of `gateway/src/site-content.ts`; the gateway repo gets a CI check that its types structurally match. Zero runtime. | — |
| `@anemalo/site-sdk` | `createAnemaloSite()`, the snake→domain mappers (moved out of `/p/grif/p/src/lib/mappers.ts`), media resolution, `submitEnquiry`, `resolveDomain`. Framework-agnostic. | `@anemalo/api-contract` |
| `@anemalo/site-sdk/react` | `AnemaloProvider` + `useSiteContent()` / `useAnemaloSite()` — a thin TanStack Query wrapper (the `/p/grif/p` `useSiteContent` hook, generalised). Peer-deps `react`, `@tanstack/react-query`. | `@anemalo/site-sdk` |

Not a monorepo dependency of `app/` — the app never imports the SDK. The SDK is for *breeder
sites*. (`app/` and `gateway/` may later share `@anemalo/api-contract` as their common type source
— that's the trigger for a workspace, per the gateway doc.)

### B.2 Core API (sketch)

```ts
import { createAnemaloSite } from "@anemalo/site-sdk";

const site = createAnemaloSite({
  org: "gryfin-york",                       // slug or id; or omit + pass resolveByHost
  apiBaseUrl: "https://api.anemalo.com",    // default
  mediaBaseUrl: "https://media.hodowlagryfinyork.pl", // optional client override; else use the
                                            // per-org base the gateway already resolved
});

const content = await site.getSiteContent();      // typed SiteContent (mapped domain types)
content.dogs[0].image;                              // fully-resolved URL, via site.media() internally
site.media("puppies/abc.webp");                     // -> "https://media.hodowlagryfinyork.pl/puppies/abc.webp"
await site.submitEnquiry({ name, email, message, interest });
const { org } = await site.resolveDomain(location.host);  // host-based multitenancy
```

- **`getSiteContent()`** fetches once, maps `SiteContentResponse` → the stable domain types
  (`BreedingDog`, `Puppy`, `PlannedLitter`, `KennelProfile`, …), and resolves every media `path`
  to a `url` using the base. The mappers are the ones already written on the `/p/grif/p` branch —
  this is a lift-and-shift, then delete them from the site.
- **`notImplemented[]`** from the response is surfaced as `content.unavailableSections` so a
  template can hide a tab instead of rendering an empty one.
- **Errors**: `AnemaloError { code, status, message }` — mirrors the gateway's `{ error, message }`
  body. `org_not_found` → the SDK throws a typed 404 the site maps to its own not-found page.
- **Caching**: the core is fetch-only (caller owns caching). `/react` supplies the Query wrapper
  with a 60s `staleTime`, matching today's `/p/grif/p`.

### B.3 Versioning

- SDK **major** = gateway contract major (`/v1` → `/v2`).
- SDK **minor** = additive contract changes (new fields, new `notImplemented` graduating to real).
  A site pinned to `^1` keeps working when litters gain `expectedColors`, posts land, etc.
- `@anemalo/api-contract` is the single place a breaking shape change is reviewed.

### B.4 What moves out of `/p/grif/p`

`src/lib/{anemalo-types,mappers,site-fallback}.ts` and `src/hooks/useSiteContent.ts` collapse into
SDK imports. `src/lib/api.ts` becomes `createAnemaloSite({ org: import.meta.env.VITE_ANEMALO_ORG })`.
`site-fallback.ts` (phone/email/socials) stays site-local **only until** the platform grows a
sanctioned public-contact surface (`organisation_public_contact` or fields on the site-config) —
tracked in `BREEDER_PANEL_GAP_ANALYSIS.md`.

---

## Part C — "New breeder → live custom site" runbook

Target: **< 30 min of operator time**, most of it DNS wait.

| # | Step | Mechanism | Built? |
|---|---|---|---|
| 1 | Create the kennel org + seed site config + set `plan` | `admin_create_kennel(p_name, p_owner_email, p_plan, …)` RPC → inserts `organisations` (approved, public), `organisation_site_configurations` (theme, sections), `organisation_members(owner)`, `user_roles(breeder)` | **gap** — `BREEDER_PANEL_GAP_ANALYSIS.md`; today only `approve_user_verification` makes orgs and it doesn't seed site config |
| 2 | Invite the breeder as owner | `invite_org_member` + `invitations.$token` landing | ✅ exists |
| 3 | Breeder fills profile / dogs / litters / puppies / posts | Anemalo **breeder panel** (single source of truth) | partial — panel parity gaps in `BREEDER_PANEL_GAP_ANALYSIS.md` (gallery, logo/cover upload, `owns_org()`→`is_org_member()` widenings, breeder `team.tsx`) |
| 4 | Scaffold the site | `degit anemalo-site-template my-kennel` → set `VITE_ANEMALO_ORG=<slug>`, pick a theme | **gap** — template repo (Part D) |
| 5 | Deploy the site | Cloudflare Worker (Nitro `cloudflare-module`) / Lovable / static export — the template ships a one-command deploy | rides on Part D |
| 6 | Attach the custom domain | `organisation_domains` row (`type=custom_domain`) + breeder adds a CNAME + `resolve_org_by_hostname(hostname)` SECURITY DEFINER RPC (gateway P6) + add the origin to the gateway CORS allowlist | **gap** — `resolve_org_by_hostname` not written; gateway `/v1/resolve-domain` is a 501 stub |
| 7 | (media) point `media.anemalo.com` at the bucket; set `media_base_url` if they want their own CDN host | Part A | **gap** — no `media.anemalo.com` yet |

Everything in steps 3–7 that a breeder never sees is an admin screen: mirror the invite/onboarding
UIs from ksef-ai / KRS-radar admin (`docs/BREEDER_PANEL_GAP_ANALYSIS.md` already scopes the
"admin adds a new breeder" screen against the RPCs).

---

## Part D — The template repo

`anemalo-site-template` — the `/p/grif/p` structure, generalised:

- TanStack Start + Router + Query, shadcn/ui, Tailwind, deploy-as-Worker — the stack `/p/grif/p`
  already proves against the gateway.
- **No `@supabase/supabase-js`.** Only `@anemalo/site-sdk`.
- `src/routes/` covers the `kennel_section` enum 1:1 (`about, dogs, litters, planned_litters,
  listings, gallery, achievements, reviews, posts, contact`). A section absent from the org's
  `visible_sections` (or present in `notImplemented`) → its route/nav entry hides.
- **Three theme skins** matching `kennel_theme` (`classic | editorial | modern`) — same components,
  different Tailwind token sets, chosen by `siteConfig.theme`.
- Config surface: `VITE_ANEMALO_ORG` (required), `VITE_ANEMALO_API_URL` (default
  `https://api.anemalo.com`), optional `VITE_MEDIA_BASE_URL` override, optional
  `VITE_SUPABASE_FUNCTIONS_URL` (only if the site keeps a legacy enquiry path pre-`/v1/enquiry`).
- `i18n` from `siteConfig.supported_languages` / `default_language`.
- Ships `robots.txt` + `sitemap.xml` built from `getSiteContent()`, and self-referential
  `<link rel="canonical">` (the SEO decision in the gateway doc: the breeder's own domain is
  canonical for their pages).

GRYFIN's real site stays a **bespoke** app (her existing design); the template is what new
breeders get by default. The `/p/grif/p` `anemalo-gateway` branch is kept as the reference
integration until the SDK exists, then rebased onto it.

---

## Phased build order

| Phase | Work | Unblocks |
|---|---|---|
| **S0** | `gryfinyork-media` *becomes* the Anemalo media bucket in place — no rename (R2 has none), no object move. Add `media.anemalo.com` as a 2nd R2 custom domain on it (keep `media.hodowlagryfinyork.pl`). **Confirm which Cloudflare account owns the bucket** vs. where `api.anemalo.com` / the Anemalo Workers run: same account → the `upload-media` Worker binds it natively (`[[r2_buckets]] bucket_name = "gryfinyork-media"`); different account → that Worker uses R2 S3-API keys as a secret (reads via the custom domain are unaffected either way). No app code. | A.4, step 6–7, S6 |
| **S1** | Media migration A.3 + gateway A.4 (`*_path` + resolved `url` in `/v1/site-content`). Update `/p/grif/p` branch mapper to read `path`+base. | one canonical media domain; SDK media resolver |
| **S2** | `@anemalo/api-contract` + `@anemalo/site-sdk` (+ `/react`). Port `/p/grif/p` to consume it. | every future site |
| **S3** | `anemalo-site-template` with 3 themes + one-command deploy. | step 4–5 |
| **S4** | `admin_create_kennel()` RPC + admin onboarding screen; breeder `team.tsx`; the `owns_org()`→`is_org_member()` widenings. | step 1–3 (from `BREEDER_PANEL_GAP_ANALYSIS.md`) |
| **S5** | `resolve_org_by_hostname()` RPC + gateway `/v1/resolve-domain` real + CORS allowlist from `organisation_domains`. | step 6, host-based multitenant deploys |
| **S6** | `upload-media` Edge Function + R2 write path (A.5); wire breeder-panel gallery/logo/cover uploads to it. | breeders adding *new* media |
| **S7** | `organisation_enquiries` + `submit_org_enquiry()` + gateway `/v1/enquiry` real. | drop the legacy Supabase enquiry hop |

S0+S1 are the answer to "import GRYFIN's media into the GRYFIN profile properly": the objects never
move, but every Anemalo surface addresses them by an org-scoped path resolved against a base the
platform controls, and GRYFIN's own site keeps her CDN hostname via the per-org override.

## Open decisions

1. **`media_assets` table now or later.** This doc says later (path+base is forward-compatible).
   Revisit if `<img>` dimension/CLS work or dedupe becomes urgent before S6.
2. **Drop the absolute `*_url` columns** after S2, or keep them as generated columns for
   belt-and-braces / non-SDK consumers (e.g. raw SQL exports, the marketplace SSR app if it
   doesn't adopt the SDK). Leaning: keep as a `GENERATED ALWAYS AS (media_base || '/' || path)`
   once every writer sets `path`.
3. **Template hosting.** Cloudflare Worker per site (isolation, custom domain native) vs. one
   shared multi-tenant Worker doing host-based resolution (cheaper, needs S5). Probably: Worker
   per site for paying `website`-plan breeders, shared for a future `pro`-plan "anemalo subdomain"
   tier.
4. **SDK distribution.** Public npm (`@anemalo/*` scope) vs. private registry / git dep while the
   contract is still moving. Start private, go public at S2 stable.
