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
`HEAD` — GET only). `media.anemalo.com` resolves but is mis-routed to the `anemalo-gateway` Worker
(A.4a).

`STORAGE_AND_MEDIA.md` (2026-09-10) first said "reuse `gryfinyork-media` as Anemalo's bucket";
**reversed 2026-09-11** — Anemalo gets its own `anemalo-media` bucket (A.4a decision 1). Gryfin's
bucket, worker and domain are untouched; her imported absolute URLs keep working.

### A.2 The rule: one platform media base; a media ref is a key **or** a URL

**There is one media base for the whole platform: `https://media.anemalo.com`** (→ the
`anemalo-media` R2 bucket, A.4a). Not one-per-org. An earlier draft had a per-org
`media_base_url` override so GRYFIN's site could keep loading images from
`media.hodowlagryfinyork.pl` — that only ever bought "no `anemalo.com` string in her page source",
which is a **white-label nicety, not a requirement**, and it isn't worth a config column + per-org
branch in every resolver. Deferred to "if a breeder actually asks" (Open decision 5).

The existing image columns (`animal_images.image_url`, `parent_dogs.profile_image_url`,
`dogs.profile_image_url`, `organisations.logo_url` / `cover_image_url`) hold a **media ref**:

- **A relative key** (`org/<org_id>/animals/<uuid>.webp`) → resolved as `https://media.anemalo.com/<key>`.
- **A full `https://…` URL** → used verbatim. This covers GRYFIN's imported
  `https://media.hodowlagryfinyork.pl/...` rows (they keep working, no rewrite needed) and any
  future breeder who joins with a big existing library on their own CDN.

Resolver, everywhere (gateway, SDK, any consumer): `ref.startsWith("http") ? ref : MEDIA_BASE + "/" + ref`.
**No schema migration for this** — same columns, a value convention + ~1 line of resolver logic.

**Why not a `media_assets` table.** A first-class `media_assets(id, org_id, storage_key, kind,
content_type, width, height, blurhash, created_by, created_at)` is the "right" long-term model
(dedupe, `<img width height>` for CLS, one delete path, EXIF-strip audit) but a big migration
across every image-bearing table + write path + RLS. **Defer it.** The ref convention above is
forward-compatible: a `media_assets` row's public projection is just its `storage_key`.

### A.3 What actually has to change

Nothing in the DB schema. The pieces:

1. Create bucket `anemalo-media`; connect `media.anemalo.com` to it (A.4a).
2. Gateway + SDK gain the one-line resolver and return a resolved `url` next to the raw `ref`
   (A.4). `public_*` view selects are unchanged — the raw column is already there.
3. New uploads write relative keys (`org/<org_id>/<kind>/<uuid>.<ext>`) into those same columns
   (A.5). GRYFIN's ~85 legacy rows stay as absolute `media.hodowlagryfinyork.pl` URLs.
4. *Optional, later:* copy the ~85 GRYFIN objects into `anemalo-media/org/<gryfin_id>/legacy/…`
   and `regexp_replace` those rows to relative keys, so everything lives in one bucket. Low
   priority; the mixed state is invisible to consumers because the resolver handles both.

### A.4 Gateway changes

`/v1/site-content` returns, for every media-bearing row, the raw `ref` **and** a resolved `url`:

```jsonc
// animal_images entry — new-style (relative key)
{ "ref": "org/2dce…/animals/9f1b….webp", "url": "https://media.anemalo.com/org/2dce…/animals/9f1b….webp" }
// animal_images entry — GRYFIN legacy (absolute, passed through)
{ "ref": "https://media.hodowlagryfinyork.pl/puppies/0ed3….webp",
  "url": "https://media.hodowlagryfinyork.pl/puppies/0ed3….webp" }
```

- `url` = `ref.startsWith("http") ? ref : MEDIA_BASE + "/" + ref`, `MEDIA_BASE` from the Worker's
  `MEDIA_BASE_URL` var (default `https://media.anemalo.com`).
- `url` is the convenience field; `ref` is the contract. A dumb client that only reads `url` still
  works for both legacy and new media.
- No new endpoint, no view change — the Worker does the string check + join on the column it
  already selects.

### A.4a Serving `media.anemalo.com` — R2 public custom domain, NOT a Worker

**Decisions:**

1. **Own bucket: `anemalo-media`.** Not reusing `gryfinyork-media` (an earlier call, now reversed
   — Open decision below). A breeder's bucket name as the platform-wide store is confusing
   forever (dashboards, wrangler, S3 keys, billing), can't be lifecycled independently, and
   Gryfin's existing worker token would span all Anemalo media. The thing that made "reuse"
   attractive — no object copy — is ~85 Gryfin objects, a 2-minute `rclone` job that isn't even
   required up front (step 4 in A.3).
2. **No Cloudflare Worker in the media *read* path.** `media.anemalo.com` attaches **directly to
   `anemalo-media`** as a public custom domain (R2 → bucket → Settings → Public access → Connect
   Domain). Reads served by R2's edge + Cloudflare cache; nothing to deploy or keep alive.
3. **Do NOT fold media into `anemalo-gateway`.** The gateway is the anon read-*data* API and
   auto-deploys on every push — coupling latency-sensitive static media to that cadence, and an
   R2 binding next to the public API, is exactly what the "separate `api.anemalo.com` Worker"
   decision argued against (`API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md` §1, §3).

**Current mis-config (2026-09-11):** `media.anemalo.com` is routed to the **`anemalo-gateway`
Worker** — `GET https://media.anemalo.com/` returns the gateway's `{"service":"anemalo-gateway",…}`
and every image path 404s. Fix: remove `media.anemalo.com` from the gateway Worker's
Domains & Routes, then connect it to `anemalo-media` per decision 2.

**Gryfin is untouched.** Her `media-worker` (behind `media.hodowlagryfinyork.pl`, R2 binding
`MEDIA` → `gryfinyork-media`, `/media-usage` accounting, write proxy) and her bucket stay exactly
as they are. Her imported image URLs keep resolving against it. Nothing here can break her site.

A dedicated `anemalo-media` **Worker** (as opposed to the bucket) is only worth it later for edge
image resizing, signed URLs for *private* media, hotlink protection, or per-org usage metering.
Not now.

### A.5 Go-forward upload path (breeder panel → R2)

The upload/write path is a **Supabase Edge Function**, not a Cloudflare Worker and not the gateway.
Stated here as the protocol the SDK assumes:

1. Breeder uploads in the **Anemalo breeder panel** (single source of truth — `/p/grif/c` is
   retired for GRYFIN, see `GRYFIN_IMPORT.md`).
2. Client compresses / HEIC-converts, then `POST`s to an **`upload-media` Supabase Edge Function
   on the Anemalo project** (`pgzvkkybqrhxedjoyjzy`) — a *new* function, not Gryfin's (that one is
   single-tenant: any logged-in user = the one office account). Authenticated with the caller's
   Anemalo `access_token`. It verifies `is_org_member(org)`, then writes to **`anemalo-media`** via
   the **R2 S3 API** (access key id + secret as Edge Function secrets — same mechanism as
   `STRIPE_SECRET_KEY`), at key `org/<org_id>/<kind>/<uuid>.<ext>`, and returns `{ ref }` (the key).
   Mirrors `create-deposit-checkout-session`'s "verify caller, do the privileged thing" shape.
3. The panel stores `ref` in the existing image column. The URL is only ever computed on read (A.4).
4. Delete = the function removes the object + the row nulls the column.

R2 credentials live only in that Edge Function — never in a browser bundle, never in the gateway
(`gateway/wrangler.toml` stays anon-key-only).

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
| 7 | (media) nothing per-breeder — `media.anemalo.com` → `anemalo-media` is a one-time platform setup (S0); new uploads land under `org/<id>/…` automatically | Part A | **gap** — `anemalo-media` + domain not set up |

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
| **S0** | Create bucket **`anemalo-media`**. (a) Remove `media.anemalo.com` from the **`anemalo-gateway`** Worker's Domains & Routes (mis-attached today — every image 404s). (b) Connect `media.anemalo.com` to `anemalo-media` as an **R2 public custom domain**. Gryfin's `gryfinyork-media` + `media-worker` + `media.hodowlagryfinyork.pl` are left untouched. No app code. | A.4a, step 6–7, S6 |
| **S1** | Gateway + `/p/grif/p` branch mapper: the one-line `ref` resolver + a resolved `url` beside the raw ref in `/v1/site-content` (A.2/A.4). No DB migration. Gryfin's absolute rows pass through unchanged. | SDK media resolver; consistent `url` for consumers |
| **S2** | `@anemalo/api-contract` + `@anemalo/site-sdk` (+ `/react`). Port `/p/grif/p` to consume it. | every future site |
| **S3** | `anemalo-site-template` with 3 themes + one-command deploy. | step 4–5 |
| **S4** | `admin_create_kennel()` RPC + admin onboarding screen; breeder `team.tsx`; the `owns_org()`→`is_org_member()` widenings. | step 1–3 (from `BREEDER_PANEL_GAP_ANALYSIS.md`) |
| **S5** | `resolve_org_by_hostname()` RPC + gateway `/v1/resolve-domain` real + CORS allowlist from `organisation_domains`. | step 6, host-based multitenant deploys |
| **S6** | `upload-media` Edge Function + R2 write path (A.5); wire breeder-panel gallery/logo/cover uploads to it. | breeders adding *new* media |
| **S7** | `organisation_enquiries` + `submit_org_enquiry()` + gateway `/v1/enquiry` real. | drop the legacy Supabase enquiry hop |

"Import GRYFIN's media into the GRYFIN profile properly" = **nothing to import**. Her rows already
hold working absolute URLs; they're the pass-through case of the ref convention. S0 stands up
`anemalo-media` + `media.anemalo.com` for *new* uploads (hers and every future breeder's); the
optional legacy copy (A.3 step 4) folds her old objects into `anemalo-media` whenever, invisibly.

## Open decisions

1. **`media_assets` table now or later.** This doc says later (the ref convention is
   forward-compatible). Revisit if `<img>` dimension/CLS work or dedupe becomes urgent before S6.
2. **Per-org `media_base_url` (white-label).** Dropped from the core design — one platform base
   (`media.anemalo.com`) for everyone. Add it back only if a breeder explicitly wants zero
   `anemalo.com` strings in their site source; then it's one nullable column + one branch in the
   resolver, and their old `media.<their-domain>` keeps working via the absolute-URL path anyway.
3. **Reused vs. own bucket** — RESOLVED 2026-09-11: own bucket `anemalo-media`. The earlier
   `STORAGE_AND_MEDIA.md` "reuse `gryfinyork-media`" line is superseded; the ~85-object legacy
   copy is optional and deferred (A.3 step 4).
4. **Template hosting.** Cloudflare Worker per site (isolation, custom domain native) vs. one
   shared multi-tenant Worker doing host-based resolution (cheaper, needs S5). Probably: Worker
   per site for paying `website`-plan breeders, shared for a future `pro`-plan "anemalo subdomain"
   tier.
4. **SDK distribution.** Public npm (`@anemalo/*` scope) vs. private registry / git dep while the
   contract is still moving. Start private, go public at S2 stable.
