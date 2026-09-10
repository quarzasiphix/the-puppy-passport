# API gateway + multi-tenant breeder sites on the shared Anemalo database

Status: **investigation + plan, 2026-09-10.** Nothing in here has been deployed or migrated. A
boot-tested gateway skeleton exists at [`../gateway/`](../gateway/) (see its `README.md`). No
`/p/grif/p` fork was created and no Gryfin import was run.

This doc is the architecture pass `docs/TODO_MULTI_TENANT_BREEDER_SITES.md` asked for. The
product-owner decisions in that TODO and in the task brief are taken as settled and are **not**
re-litigated here:

1. **One shared Anemalo Supabase project**, org-scoped by RLS + `organisation_id`. Onboarding a
   breeder = an `organisations` row (`org_type='kennel'`) + a seeded
   `organisation_site_configurations` row + `invite_org_member` for the owner. Not a DB/schema per
   breeder.
2. Breeders get **team members** via the existing `organisation_members` + invitation RPCs.
3. There is an **admin onboarding flow** built on the RPCs that already exist.
4. A **test fork of `/p/grif/p`** reads Anemalo through the gateway (separate later deliverable).
5. Gryfin's kennel data gets **imported** into Anemalo as one org + its dogs/litters/puppies.

## What already exists (verified against the live `anemalo` project, 2026-09-10)

- **Team + invitations backend is complete.** Tables `organisation_members`
  (`org_member_role` enum: `owner, administrator, employee, breeder, volunteer, driver, viewer,
  adoption_coordinator, transport_coordinator, animal_care_member`; `status active|suspended`) and
  `organisation_invitations`. RPCs `invite_org_member`, `accept_org_invitation`,
  `decline_org_invitation`, `revoke_org_invitation`, `get_invitation_by_token`, `remove_org_member`,
  `set_org_member_status`, `change_org_member_role`, `leave_organisation`, plus predicates
  `is_org_member()` / `owns_org()` / `can_manage_org_members()` (owner or `administrator`-role
  member). Confirmed present.
- **Service + UI layer for teams already written.** `src/domains/identity/services/team.ts` wraps
  every RPC above. `src/routes/dashboard/foundation/team.tsx` is a full, working team screen
  (invite dialog, pending-invitation list, member list with role/suspend/remove). The breeder side
  has **no `team.tsx`** — that is the gap, and it can mirror the foundation screen almost verbatim.
- **Invite landing page** `src/routes/_public/invitations.$token.tsx`.
- **`organisation_site_configurations`** (theme enum `classic|editorial|modern`, `primary_color`,
  `visible_sections[]` / `section_order[]` over a fixed `kennel_section` enum, `default_language`,
  `supported_languages[]`, `contact_mode anemalo|external|both`, `show_anemalo_branding`). Anon
  `SELECT using (true)`; write gated `owns_org(organisation_id)` + admin. Read/mapped by
  `src/domains/breeders/services/kennel-site.ts`.
- **`organisation_domains`** (`hostname`, `type anemalo_subdomain|custom_domain`,
  `status pending|verifying|active|failed|disabled`, `verification_token uuid`, `is_primary`,
  reserved-subdomain trigger, global-unique hostname index, one-primary-per-org partial index).
  **No anon/public `SELECT` policy at all** (by design), write gated `owns_org` + admin. No DNS,
  cert, or routing built.
- **`organisations.plan`** (`free|pro|website`, default `free`) + `getKennelCapabilities(plan)` in
  `src/domains/breeders/types.ts` — `canAddTeamMembers`, `canUseCustomDomain`, `canUseSubdomain`,
  `canCustomizeTheme`, `canRemoveAnemaloBranding`, media/import/language limits. Not billing-enforced.
- **Pedigree graph is live-schema** (`dogs` permanent identity, `parent_dogs.dog_id` /
  `animals.dog_id`, auto-identity triggers, `public_dogs` view). See `docs/PEDIGREE_GRAPH.md`.
- **`public_*` anon-safe views**: `public_dogs`, `public_dog_parent_relationships`,
  `public_transport_requests`, `public_routes`, `public_fundraising_totals`,
  `public_fundraising_contributions`, `public_kennel_owner_identity_verification`,
  `public_organisation_trust_claims`, `public_transport_rating`. `public_dogs` is `anon`-SELECT.
- **Org creation today only happens via `approve_user_verification(p_verification_id, p_admin_notes)`**
  — it reads a user-submitted `user_verifications` row (`verification_type in ('breeder',
  'organisation')`), inserts `organisations` (status `approved`, `is_public true`), inserts
  `organisation_members(owner)`, grants a `user_roles` row. It does **not** seed
  `organisation_site_configurations`, and there is **no admin "create org directly" RPC**.
- **Rate-limit infra**: `enforce_rate_limit(p_action_key text, p_max_count int, p_window interval)`
  + table `rate_limit_events(actor_profile_id, action_key, created_at)`. **It early-returns when
  `auth.uid()` is null** — i.e. it does nothing for anonymous callers. Trigger-based limiters exist
  for authenticated actions (`rate_limit_application_submission`, `rate_limit_message_send`, …).
- **No lead/enquiry/contact table.** `buyer_applications` needs an authenticated `buyer_id` and a
  large structured payload — not a fit for an anonymous "message this breeder" form.

---

## 1. Gateway architecture decision

### Recommendation: a **separate `api.anemalo.com` Worker**, not `anemalo.com/api/*`.

| Factor | Separate `api.anemalo.com` Worker | Path-based on the existing Worker |
|---|---|---|
| **CORS** | Public read API wants `access-control-allow-origin: *` (breeder sites on their own domains fetch it). The main app is same-origin SSR with **no** CORS today. Keeping them separate means one wrong CORS header can't widen the main app's surface. | Would add wildcard-CORS branches into `src/server.ts`'s raw-fetch intercept, next to `/health` and `/sitemap.xml`. Easy to get subtly wrong. |
| **Rate limiting / abuse** | The API is anonymous and hit from many third-party origins. It needs its own Cloudflare Rate Limiting tier. An attack on the API must never throttle or knock over `anemalo.com` itself. | Shared limiter and shared isolate CPU/subrequest budget — API abuse degrades the main site. |
| **Deploy independence** | The API contract (`/v1/*`) is a product surface breeders' sites + a future SDK pin to. It should deploy on its own cadence, not ride every main-app deploy (which is frequent and Nitro/Vite-driven). | Every API change = a full main-app rebuild + redeploy; every main-app deploy risks the API. |
| **Contract clarity** | `api.anemalo.com/v1/site-content` is an obvious, documentable, versionable public endpoint. | `anemalo.com/api/...` blurs "our app's private endpoints" and "the public contract". |
| **Infra cost** | One extra Worker. Cloudflare's free tier is generous; the main app already deploys as a Worker so this is a known quantity. | Zero extra infra — the only real advantage. |
| **Precedent** | Matches ksef-ai exactly: `api.ksiegai.pl` is its own Cloudflare Worker repo (`ksiegai-gateway`) in front of the shared Supabase project. | — |

The one honest cost of "separate" is a second deploy target and a second `wrangler.toml`. Given
the CORS and rate-limit isolation arguments, that is worth paying.

### Repo location: `gateway/` inside this repo (pragmatic), aim for a sibling repo later.

The brief's first choice was a sibling dir `/p/anemalo-gateway/`. **That path is not writable in
this workspace**, so the skeleton lives at [`../gateway/`](../gateway/) with its own
`package.json` / `tsconfig.json` / `wrangler.toml`. This is fine and arguably better short-term:

- The main `tsconfig.json` `include` is scoped to `src/**`, so `gateway/` is invisible to the
  app's `tsc`/`eslint`/Vite/Nitro build — no coupling, no accidental bundling.
- The gateway's contract, this doc, and the follow-up migrations all live together.
- `node_modules` / `.wrangler` under `gateway/` are already covered by the repo `.gitignore`.

If/when the API grows its own CI and release cadence, lift `gateway/` into a standalone repo
(`anemalo-gateway`) — nothing in the skeleton assumes its parent directory.

---

## 2. Gateway responsibilities & v1 endpoint surface

The gateway is **read-mostly, org-scoped, anonymous**. It is the single audited place where
"which columns of which tables are safe to show the public" is decided — the same posture as the
`public_transport_requests` / `public_fundraising_totals` views.

### Auth model

- **Anon key, server-side, inside the Worker.** RLS is the boundary (identical stance to the main
  app — `docs/DEPLOYMENT_CHECKLIST.md` §4). Every table the `site-content` endpoint reads was
  confirmed to have an `anon`-role `SELECT` policy that already restricts rows to
  *published + approved + public*:
  - `organisations` — `verification_status = 'approved' AND is_public`
  - `organisation_site_configurations` — `using (true)` (carries no private data)
  - `public_dogs` — `anon` grant, view over pedigree identities
  - `litters` — `is_published AND kennel approved+public`
  - `animals` — `is_published AND listing_category IN ('breeder_puppy','adoption') AND org approved+public`
  - `animal_images` — images of the above
  - `achievements` — `public reads verified achievements of public approved kennels`
- **No service-role key in the Worker.** The one endpoint that genuinely needs an elevated read is
  `resolve-domain` (`organisation_domains` has no anon policy on purpose). The least-privilege fix
  is a `SECURITY DEFINER` RPC granted to `anon` (below), **not** a service-role key in
  `wrangler.toml`. If a future endpoint truly needs service-role, add it with `wrangler secret put`
  and record the justification here.

### Endpoints

| Endpoint | Purpose | Backing | v1 state |
|---|---|---|---|
| `GET /health` | Liveness + `head` count probe on `organisation_site_configurations`. | anon | **implemented** |
| `GET /v1/site-content?org=<slug\|id>` | One JSON payload: org row, site config, `public_dogs`, published litters, published animals (puppies), their images, achievements. `testimonials`/`posts` returned as `notImplemented: [...]`. 404 when the org isn't publicly visible (unapproved/suspended/unknown are deliberately indistinguishable). `cache-control: public, max-age=60, stale-while-revalidate=300`. | anon | **implemented** |
| `GET /v1/resolve-domain?host=<hostname>` | `Host` → `{ org: slug, plan, status }`. Calls `resolve_org_by_hostname(text)`. | anon → SECURITY DEFINER RPC | **handler implemented, returns an honest 501** until the RPC is created (§6 / P6). |
| `POST /v1/enquiry` | Lead capture `{ org, name, email, message, phone?, interest? }`. Validates, then refuses. | — | **honest 501** — no backend table yet (below). No fake success (`CLAUDE.md` rule 12). |

### `POST /v1/enquiry` — what it needs before it can be real

A follow-up migration (not written here) should add:

- `public.organisation_enquiries` — `id, organisation_id, name, email, phone, interest, message,
  source_hostname, created_at, status`. RLS: **no** anon `SELECT`; `INSERT` only via the RPC
  below; `SELECT`/`UPDATE` for `is_org_member(organisation_id)` (so the breeder team sees leads in
  the dashboard) + admin.
- `submit_org_enquiry(p_org_slug text, p_name text, p_email text, p_message text, p_phone text,
  p_interest text)` — `SECURITY DEFINER`, granted to `anon`. Resolves the slug to an approved
  public org, inserts one row, fires a `create_notification_if_enabled()` to the org's members.
- **IP-based rate limiting inside that RPC** (or in the gateway) — `enforce_rate_limit()` is a
  no-op for anon, so it can't be reused as-is. Simplest: a `p_client_ip inet` arg + a small
  `anon_rate_limit_events(ip, action_key, created_at)` table with the same
  delete-old-then-count-then-insert shape as `enforce_rate_limit`. The Worker passes
  `request.headers.get('cf-connecting-ip')`.

### Rate limiting (the gateway's own job)

Because `enforce_rate_limit()` does nothing for anonymous callers, throttling for
`/v1/site-content` and `/v1/resolve-domain` must live in the Worker:

- **Cloudflare Rate Limiting rules** on the `api.anemalo.com` route (simplest, no code), or
- a **KV / Durable Object counter** keyed on `cf-connecting-ip` + path for finer control.

The DB-side `submit_org_enquiry` limiter above is a second, independent gate on the one write
endpoint (defence in depth, mirrors ksef-ai's `/v1/public` allowlist sitting on top of
`public-api`'s own dispatch).

---

## 3. ksef-ai gateway pattern — what we're copying

Source: `/mnt/c/k/ksef-ai/supabase/functions/EDGE_FUNCTION_ARCHITECTURE.md` and the functions
`get-anonymous-invoice-summary`, `invoice-payments-public`, `public-api`, `admin-invite-track`,
`create-accounting-workspace`, `ksiegai-webhook-contract`. ksef-ai puts a Cloudflare Worker
(`ksiegai-gateway` = `api.ksiegai.pl`) in front of a small number of Supabase edge functions, one
function **per trust tier** (not per action).

**Adopt:**

1. **Separate Worker as the single public choke point** — `api.anemalo.com`, same as
   `api.ksiegai.pl`. One discoverable surface, one place for rate limiting, structured logging,
   WAF rules, and killing a route in an incident without touching Supabase.
2. **Trust-tier separation is the boundary that gets its own code path**, not convenience.
   ksef-ai never merges anonymous-tier logic with admin-tier logic in one function. For Anemalo:
   the anonymous `site-content`/`resolve-domain`/`enquiry` surface stays strictly separate from
   anything that would ever take a privileged action. If an admin/service-role API is ever needed
   (e.g. a machine-to-machine onboarding endpoint), it is a **different deployment** with its own
   auth, never another route on this Worker.
3. **Anonymous endpoints resolve an opaque identifier to a concrete row, select explicit
   columns, and return a shaped response** — exactly `get-anonymous-invoice-summary`
   (`submissionId` → one row → hand-picked fields). Anemalo's `site-content` does the same with
   `org` → `organisations` row → explicit column lists per table.
4. **CORS + `OPTIONS` handled explicitly on every response**, `content-type: application/json`,
   errors as `{ error, message }` with a real status code — matches every ksef-ai function.
5. **"Hiding Supabase" is honest about what it buys.** Per ksef-ai's own doc: the anon key and
   project ref are still in every client bundle; RLS is still the real boundary. The gateway adds
   a rate-limit/logging/incident-control choke point and a stable contract — **not** secrecy.
   Do not write `# TODO: security via gateway` reasoning here either.
6. **Stable, versioned, published contract.** ksef-ai has `ksiegai-webhook-contract` (HMAC-signed,
   timestamped, documented payloads) and a `PUBLIC_API_ACTION_ALLOWLIST`. Anemalo's contract is
   the `/v1/*` path prefix + this doc's endpoint table + the `SiteContentResponse` shape in
   `gateway/src/site-content.ts`. Breaking changes ⇒ `/v2`.
7. **Build and boot-test the gateway route standalone before switching any caller** — ksef-ai
   built every gateway route before migrating a single frontend call. The `/p/grif/p` fork (P5) is
   deliberately downstream of the gateway existing and being tested.
8. **Invite tracking** — `admin-invite-track` is a 1×1 tracking-pixel + click-redirect edge
   function that writes invite funnel events via a `track_admin_invite_progress` RPC. If Anemalo
   wants "did the breeder open / click their invite" telemetry in the admin onboarding screen (§5),
   copy this shape: a `GET /v1/invite/track?event=open|click&token=<hash>` route on the gateway
   writing through a `SECURITY DEFINER` RPC. Not v1, but the gateway design leaves room for it.

**Deviate:**

- ksef-ai's public function uses the **service-role key** and leans entirely on careful in-code
  scoping. Anemalo should stay on the **anon key + RLS + `public_*` views** — the project already
  has that discipline and the audited view pattern; it's a stronger default than "service-role but
  we're careful".
- ksef-ai uses **Supabase edge functions (Deno)** behind the Worker; the Worker is a thin proxy.
  Anemalo has no edge functions in play here and doesn't need the extra hop — the Worker talks to
  PostgREST/RPC directly with `@supabase/supabase-js`. (If a write surface with heavy logic
  appears later, revisit: a `submit_org_enquiry`-style RPC is enough for now; a Deno function is
  the escalation path, not the default.)
- ksef-ai's action-dispatch (`POST` with `{ action: "domain.verb" }`) is built for dozens of
  actions per function. Anemalo's v1 is 4 endpoints — plain `METHOD /path` routing (as in
  `src/server.ts`) is lighter and clearer. Adopt action-dispatch only if the surface passes ~10
  endpoints.

---

## 4. How a breeder public site consumes the gateway

Target posture (mirror `/p/grif/p` exactly): **the breeder site app has no
`@supabase/supabase-js` dependency.** Everything comes from `api.anemalo.com` over `fetch`.

- **Content**: `GET https://api.anemalo.com/v1/site-content?org=<slug>` once, at SSR/build, wrapped
  in `useSuspenseQuery` with a ~60s `staleTime` — the same hook shape as `/p/grif/p`'s
  `useSiteContent()`. A `src/lib/mappers.ts` equivalent turns the gateway's snake_case-ish payload
  into the app's camelCase domain types. `SiteContentResponse` in `gateway/src/site-content.ts` is
  the contract.
- **Which org**: two ways, must both work —
  1. **Static config** — the template app is built with `ANEMALO_ORG=<slug>` baked in (the common
     case: one app instance per breeder).
  2. **Host-based** — for a shared multi-tenant deployment, the app calls
     `GET /v1/resolve-domain?host=<incoming Host header>` first, gets `{ org }`, then fetches
     `site-content`. This is the path that needs the `resolve_org_by_hostname` RPC (§6).
- **Enquiries**: `POST https://api.anemalo.com/v1/enquiry` with `{ org, name, email, message }` —
  a drop-in for `/p/grif/p`'s `submitEnquiry()`. Returns 501 until the backend table lands.
- **Media**: `logo_url` / `cover_image_url` / `animal_images[].image_url` are returned as-is.
  Today they're relative `/images/seed/...` paths in seed data; real uploads resolve to the
  Anemalo storage/CDN origin. The template app must treat them as absolute-or-prefixable URLs.

### SEO / canonical strategy (the `docs/TODO_MULTI_TENANT_BREEDER_SITES.md` concern)

The same kennel is reachable at `anemalo.com/breeders/<slug>` **and** at the breeder's own domain.
Without a rule they compete as duplicate content.

**Decision: the breeder's own primary domain is canonical for the kennel's own pages.**

- On the breeder site: `<link rel="canonical" href="https://<their-domain>/...">` — self-referential.
- On `anemalo.com/breeders/<slug>`: when `organisation_domains` has an `is_primary`, `active`
  `custom_domain` for that org, emit `<link rel="canonical" href="https://<custom-domain>/">` on
  the Anemalo kennel page **and** keep the Anemalo page in the marketplace/discovery index (it's
  still the discovery entry point — it just points authority at the breeder's site).
- If the org has **no** custom domain, `anemalo.com/breeders/<slug>` is self-canonical.
- `hreflang`: the breeder site emits `hreflang` per `supported_languages` from the site config;
  Anemalo's own page stays `hreflang`-scoped to Anemalo's locales. The two sites do **not**
  cross-reference each other with `hreflang` (different domains, different content trees).
- Per-breeder `sitemap.xml` on the breeder domain lists only that org's URLs. Anemalo's sitemap
  keeps listing `/breeders/<slug>` as a discovery URL.
- `organisation_site_configurations.show_anemalo_branding` stays independent of canonical — it's a
  UI/attribution flag, not an SEO signal.

This needs: a resolver the Anemalo kennel-page SSR loader can call to know an org's primary custom
domain (a small `public_primary_domains` view *would* be the easy answer but `organisation_domains`
deliberately has no anon read — so reuse the same `resolve_org_by_hostname` RPC's inverse, e.g. a
`get_org_primary_hostname(p_org_id uuid)` `SECURITY DEFINER` function granted to `anon`).

---

## 5. Breeder team management

### The UI gap

`src/routes/dashboard/breeder/team.tsx` **does not exist**. Create it by mirroring
`src/routes/dashboard/foundation/team.tsx` (which is complete and working):

- Swap `getMyFoundation(userId)` → the breeder's org lookup (`getMyKennel` — see
  `src/domains/breeders/index.ts`).
- `invitableRoles` for a kennel: `['administrator', 'breeder', 'employee', 'animal_care_member',
  'viewer']` (drop the foundation-specific `adoption_coordinator` / `volunteer`; keep
  `transport_coordinator` only if the kennel does its own transport).
- Gate the whole screen on `getKennelCapabilities(org.plan).canAddTeamMembers` (true for
  `pro` / `website`, false for `free`) — show an upgrade-prompt empty state on `free`, matching how
  `settings.tsx` already reads capabilities.
- Add a nav entry in `src/app/config/navigation.ts` under the breeder section.
- **No new service code** — `src/domains/identity/services/team.ts` already exports everything
  (`listOrgMembers`, `listOrgInvitations`, `inviteOrgMember`, `revokeOrgInvitation`,
  `removeOrgMember`, `setOrgMemberStatus`, `changeOrgMemberRole`).

The invited person's side (`invitations.$token.tsx` + `accept_org_invitation`) already works for
any org type — no change.

### Write-gate widening: `owns_org()` → `is_org_member()` (or a role-aware predicate)

Today almost every breeder-dashboard write is **owner-only**. For a team to actually help, these
RLS policies need widening. **Every item below is a follow-up migration — none are written here.**

| # | Table | Policy (current) | Current gate | Proposed |
|---|---|---|---|---|
| 1 | `litters` | "owners manage their kennel's litters" (`ALL`) | `owns_org(kennel_id)` | `org_member_can(kennel_id, 'content')` |
| 2 | `parent_dogs` | "owners manage their kennel's parent dogs" (`ALL`) | `owns_org(kennel_id)` | `org_member_can(kennel_id, 'content')` |
| 3 | `animals` | "org owners manage their organization's animals" (`ALL`) | `owns_org(organization_id)` | `org_member_can(organization_id, 'content')` — **but** flipping `is_published` / editing `price` needs `'publish'` (see note) |
| 4 | `animal_images` | "owners manage images of their own animals" (`ALL`) | nested `owns_org(a.organization_id)` | nested `org_member_can(a.organization_id, 'content')` |
| 5 | `achievements` | "owners manage their kennel's achievements" (`ALL`) | `owns_org(kennel_id)` | `org_member_can(kennel_id, 'content')` |
| 6 | `reservations` | INSERT / SELECT / UPDATE (3 policies) | `owns_org(organization_id)` | `org_member_can(organization_id, 'sales')` |
| 7 | `buyer_applications` | "org owners view/update applications for their animals" (SELECT + UPDATE) | `owns_org(organization_id)` | `org_member_can(organization_id, 'sales')` |
| 8 | `notifications` | "org owners notify applicants to their organisation" (INSERT) | `owns_org(ba.organization_id)` | `org_member_can(ba.organization_id, 'sales')` |
| 9 | `private_addresses` | "org owners manage their organisation's private address" (`ALL`) | `owns_org(owner_org_id)` | keep `owns_org` **or** `org_member_can(owner_org_id, 'settings')` — this is a home address, lean strict |
| 10 | `organisation_site_configurations` | "org owners manage their kennel's site configuration" (`ALL`) | `owns_org(organisation_id)` | `org_member_can(organisation_id, 'settings')` (owner + `administrator`) |
| 11 | `organisation_domains` | "org owners manage their kennel's domains" (`ALL`) | `owns_org(organisation_id)` | `org_member_can(organisation_id, 'settings')` |
| 12 | `transport_requests` | "named parties view the transport request" (SELECT) — the `owns_org(sender_org_id)` arm | `owns_org(sender_org_id)` | `org_member_can(sender_org_id, 'transport')` |
| 13 | `transport_request_animals` | "org owners view their animals linked from a transport request" (SELECT) | nested `owns_org(a.organization_id)` | nested `org_member_can(a.organization_id, 'transport')` |
| 14 | `posts` (already done, listed for completeness) | "post as kennel" | already `is_org_member()` (widened in `20260903000200`) | — |

**Keep `owns_org()`-only — do NOT widen:**

- `organisations` UPDATE ("owners update their own organisation") — verification/identity-adjacent.
  If a non-owner needs to edit the public description, split a narrow `update_org_public_profile()`
  RPC rather than widening the table policy.
- The `prevent_org_owner_transfer_by_non_admin` trigger and all `organisation_members` /
  `organisation_invitations` management — already correctly `can_manage_org_members()` (owner +
  `administrator`), and `invite_org_member` already forbids a non-owner minting an
  `owner`/`administrator`.
- `fundraising_campaigns` — revenue/legal; owner-only per `docs/FUNDRAISING_POLICY.md`.

### The role → capability map (needs one new predicate)

Introduce **one** `SECURITY DEFINER STABLE` helper so the policy churn is uniform and the matrix
lives in exactly one place:

```
org_member_can(p_org_id uuid, p_capability text) returns boolean
-- true if owns_org(p_org_id) OR the caller is an active organisation_members row whose
-- member_role grants p_capability per this table:
```

| role | `content` | `publish` | `sales` | `transport` | `settings` |
|---|:-:|:-:|:-:|:-:|:-:|
| `owner` | ✔ | ✔ | ✔ | ✔ | ✔ |
| `administrator` | ✔ | ✔ | ✔ | ✔ | ✔ |
| `breeder` | ✔ | ✔ | ✔ | ✔ | – |
| `employee` | ✔ | – | ✔ | ✔ | – |
| `animal_care_member` | ✔ | – | – | – | – |
| `transport_coordinator` | – | – | – | ✔ | – |
| `adoption_coordinator` | ✔ | – | ✔ | – | – |
| `viewer` | – | – | – | – | – |

**The `publish` nuance** (item 3): "a `viewer` can't publish" generalises to "only `content` gets
you edits, only `publish` flips `is_published` / sets `price`". Enforcing that split needs a
`BEFORE UPDATE` trigger on `animals`/`litters` that raises if `is_published`/`price` changed and
`NOT org_member_can(org, 'publish')` — RLS `WITH CHECK` alone can't compare old vs new. Flag as
part of the same migration.

### Follow-up migrations this section implies (none written)

1. `org_member_can(uuid, text)` helper + the capability table as a `CASE`.
2. Re-`CREATE POLICY` for items 1–13 above swapping the predicate.
3. `enforce_publish_capability` trigger on `animals` + `litters`.
4. `update_org_public_profile()` narrow RPC (optional, for the `organisations` carve-out).
5. RLS regression tests (`npm run test:db`) covering: `viewer` blocked from every write;
   `animal_care_member` can edit an animal's notes but not publish it; `employee` can approve a
   `buyer_application` but not change site config; a suspended member loses all of it (already
   handled by `is_org_member()`'s `status='active'` check — confirm it flows through
   `org_member_can`).

---

## 6. Admin onboarding flow

Screens under `src/routes/dashboard/admin/*`. Today `admin/organisations.tsx` only lists orgs and
toggles `is_featured` / `verification_status` (`src/domains/identity/services/organisations.ts`).
There is **no create-org path** in the UI or at the RPC layer for an admin.

### What's missing at the RPC layer

`approve_user_verification()` is the *only* function that creates an `organisations` row, and it:

- **requires a user-submitted `user_verifications` row** — an admin can't originate an org for a
  breeder who hasn't applied;
- **does not seed `organisation_site_configurations`** — so every kennel created this way renders
  on config defaults until the owner touches settings;
- hard-codes `is_public = true, verification_status = 'approved'`.

Admins *can* already `INSERT` into `organisations`, `organisation_members`, and
`organisation_site_configurations` directly (the `is_admin()` `ALL` policies allow it), so a
client-only onboarding screen is technically possible. But the clean fix is one RPC:

```
admin_create_kennel(
  p_name text,
  p_owner_email text,
  p_country text, p_city text,
  p_plan text default 'free',
  p_seed_site_config boolean default true,
  p_custom_domain text default null      -- §8 domain-attach path (a)
) returns uuid   -- new organisation_id
```

`SECURITY DEFINER`, `is_admin()`-gated. It: inserts the `organisations` row
(`org_type='kennel'`, `verification_status='approved'`, `is_public=true`, `owner_user_id` = the
profile for `p_owner_email` if it exists else `null`); inserts the `organisation_members(owner)`
row if the profile exists; if `p_seed_site_config` inserts a default
`organisation_site_configurations` row; if `p_custom_domain` inserts an `organisation_domains`
row (`type='custom_domain'`, `status='pending'`, fresh `verification_token`); calls
`invite_org_member(new_org_id, p_owner_email, 'owner')`; writes an `audit_logs` entry. Idempotent
on `(name, owner_email)` or return the existing org.

**Also fix `approve_user_verification()`** in the same migration to seed a default
`organisation_site_configurations` row (so both onboarding paths converge).

### The screen

`src/routes/dashboard/admin/onboard-breeder.tsx` (new), or a "＋ Add breeder" dialog on
`admin/organisations.tsx`. One short guided form (matches `CLAUDE.md`'s onboarding UX bar):

1. Kennel name, owner email, country/city, plan.
2. Optional: custom domain (feeds `p_custom_domain`; the breeder verifies the TXT record later —
   §8).
3. Optional: "seed a starter site" checkbox (→ `p_seed_site_config`, later a template picker).
4. Preview → submit → success screen: "Kennel created. Invitation sent to `<email>`. Their site
   is at `anemalo.com/breeders/<slug>` and (if a domain was added) will go live on `<domain>` once
   they add the DNS TXT record." — specific, non-generic, per `CLAUDE.md`.

### Reference: the existing verification → org path

`docs/` describes today's flow as: user submits `user_verifications` (`verification_type =
'breeder'`) → admin reviews in `src/routes/dashboard/admin/breeder-verification.tsx` → clicks
approve → `approve_user_verification()` mints the org + owner membership + `breeder` role. The
admin onboarding flow is the **proactive** sibling of that reactive path — same end state, started
by staff instead of by the breeder. Keep both.

---

## 7. Gryfin import

A one-off, idempotent, **dry-run-first** Node script hitting the Anemalo Supabase with the
**service-role key** (this is legitimate service-role use — a bulk backfill, run once, from a
trusted machine, never from the gateway). Location: `scripts/import-gryfin.ts` in this repo (not
built this pass). `/p/grif`'s own `supabase/` schema isn't checked out here, so the source column
names below come from `/p/grif/c/src/lib/dbMapping.ts` + `/p/grif/p/src/lib/mappers.ts` and must
be re-confirmed against the real Gryfin DB before running.

### Identity

The Gryfin owner gets: an `auth.users` row (invite or admin-create) → `profiles` row →
`organisation_members(owner)` on the imported org. Until they accept, `owner_user_id` can be
`null` and the org still renders (public reads don't need an owner). Run `admin_create_kennel`
(§6) for the org shell, then the script fills in dogs/litters/puppies.

### Field mapping

| Gryfin source | → Anemalo target | Notes |
|---|---|---|
| `site_settings` (singleton `id=1`): `kennel_name` | `organisations.name` | |
| `site_settings.location` | `organisations.public_location` / `city` / `country` | split "Łódź, Poland" |
| `site_settings.phone` / `email` | owner `profiles` contact + `organisations` (no phone column — goes to `private_addresses`/profile) | not public on the org row |
| `site_settings.facebook_url` / `tiktok_url` | — | no social-link columns on `organisations` yet; park in site config or a follow-up column |
| `site_settings.founded_year` | `organisations.years_experience` (derive) | or a real `founded_year` column (follow-up) |
| `site_settings.show_*` toggles | `organisation_site_configurations.visible_sections[]` | map `show_available_puppies`→`listings`/`litters`, `show_reviews`→`reviews`, `show_gallery`→`gallery` |
| n/a | `organisation_site_configurations` (theme `classic`, `default_language='pl'`, `supported_languages=['pl']`, `contact_mode='both'`) | seed row |
| `dogs.name` / `registered_name` | `parent_dogs.call_name` / `registered_name` | |
| `dogs.sex` (`samiec`/`suczka`) | `parent_dogs.sex` (`male`/`female`) | |
| `dogs.color` / `birth_date` | `parent_dogs.color` / `date_of_birth` | |
| `dogs.health_tests[]` | `parent_dogs.health_tests jsonb` | array → `[{test: "..."}]` |
| `dogs.achievements[]` | `achievements` rows (`kennel_id`, `title`, `verification_status='breeder_provided'`) | one row per entry |
| `dogs.pedigree` (free text) | `parent_dogs.description` append, or a `pedigree_sources` (`source_type='breeder_declaration'`, `review_state='pending'`) | prefer the pedigree-graph path per `docs/PEDIGREE_GRAPH.md` |
| `dogs.photo_url` + `photo_urls[]` | `parent_dogs.profile_image_url` + (no multi-image table for parent dogs) | first photo → profile image; rest parked |
| `dogs.description` / `character` | `parent_dogs.description` | concat |
| auto | `dogs` identity row via the `parent_dogs` insert trigger | no manual insert — the trigger mints it |
| `litters.name` / slug | `litters.code` | |
| `litters.mother_id` / `father_id` | `litters.mother_id` / `father_id` → the imported `parent_dogs` ids | remap via an id map built during the run |
| `litters.planned_date` / `birth_date` | `litters.expected_birth_date` / `birth_date` | |
| `litters.puppies_count` | `litters.puppy_count` | |
| `litters.expected_colors[]` | `litters.description` (append) or a follow-up column | no array column |
| `litters.status` (`planowany`/…) | `litters.status` + `is_published` | map PL status → Anemalo enum; `visible_on_site` → `is_published` |
| `puppies.name` / `sex` / `color` / `birth_date` | `animals.name` / `sex` / `color` / `date_of_birth` | `listing_category='breeder_puppy'` |
| `puppies.litter_id` | `animals.litter_id` | remap |
| `puppies.ready_from` | `animals.availability_status` + (no `ready_date` on animals — `litters.ready_date`) | |
| `puppies.status` (`dostepny`/`zarezerwowany`/…) | `animals.availability_status` | map to Anemalo enum |
| `puppies.description` / `temperament` / `socialization` | `animals.description` / `temperament` / `ideal_home` | |
| `puppies.health_info[]` | `animals.health_tests` | |
| `puppies.expected_weight` | `animals.weight_kg` (parse) / `size_category` | |
| `puppies.photo_url` + `photo_urls[]` | `animal_images` rows (`is_cover` on the first) | |
| `puppies.visible_on_site` | `animals.is_published` | |
| `testimonials.*` | **no Anemalo table** — hold until `organisation_enquiries`/a reviews table exists | out of scope; export to JSON |
| `gallery_images.*` | `animal_images` where a `dog_id` maps; standalone gallery images have no home yet | partial |
| `enquiries.*` | `organisation_enquiries` once it exists (§2) | out of scope |
| `people_directory` / `kennels` (if present in Gryfin) | `profiles` / `organisations` | re-confirm against real schema |

### Run shape

```
scripts/import-gryfin.ts --source-url <gryfin> --source-key <gryfin service key> \
  --target-url <anemalo> --target-key <anemalo service key> --owner-email <x> [--commit]
```

Default = dry run: prints the full plan (N orgs, N parent_dogs, N litters, N animals, N images)
and every unmapped field, writes `import-gryfin.report.json`, changes nothing. `--commit` runs it
inside a single logical pass with an id map so re-runs upsert (idempotent on Gryfin source ids
stored in a `source_ref` / staging column or an `external_ids` map table — decide before writing).
Photos: copy bytes into Anemalo storage, don't hot-link Gryfin's R2.

---

## 8. Custom-domain attach + verification, and a future "Anemalo Connect" SDK

### Two entry points for a domain (both required)

- **(a) Admin, at onboarding** — the `p_custom_domain` arg on `admin_create_kennel` (§6) inserts a
  `pending` `organisation_domains` row with a fresh `verification_token`.
- **(b) Breeder, self-serve later** — `src/routes/dashboard/breeder/settings.tsx` already reads
  `getKennelCapabilities().canUseCustomDomain`; add a "Domains" card that inserts/reads
  `organisation_domains` (write policy is already `owns_org` → will become
  `org_member_can(..., 'settings')` per §5). A `src/domains/breeders/services/domains.ts` wrapping
  the CRUD.

### TXT-record verification flow (nothing built)

1. Breeder adds a `custom_domain` row → `status='pending'`, `verification_token` = a uuid.
2. UI shows: *"Add this DNS record: `TXT _anemalo-verify.<hostname>` = `<verification_token>`"*
   (or `TXT <hostname>` = `anemalo-verify=<token>` — pick one and document it in the contract).
3. Breeder clicks **Verify**. That calls a new endpoint —
   `POST /v1/verify-domain { org_slug, hostname }` on the gateway, or a
   `verify_org_domain(p_domain_id uuid)` RPC — which does a DNS-over-HTTPS `TXT` lookup
   (`https://cloudflare-dns.com/dns-query?name=_anemalo-verify.<host>&type=TXT`, allowed from a
   Worker), compares, and on match sets `status='active'` (+ `verifying` as an interim state).
4. A **scheduled re-check** (Cloudflare Cron trigger on the gateway, or a `pg_cron` job) re-runs
   the lookup for `active` domains daily; a disappeared record → `status='failed'` and the site
   falls back to `anemalo.com/breeders/<slug>`.
5. Only an `active` domain is returned by `resolve_org_by_hostname` (§2/§4) and only an `active`
   `is_primary` domain drives the canonical tag (§4 SEO).
6. Certificate issuance for the custom hostname is a **Cloudflare for SaaS / custom-hostnames**
   concern — out of scope here, noted as the real infra dependency before "(b)" is user-facing.

The RPCs this implies (follow-up, not written): `resolve_org_by_hostname(text)`,
`get_org_primary_hostname(uuid)`, `verify_org_domain(uuid)` — all `SECURITY DEFINER`,
`resolve_*`/`get_*` granted to `anon`, `verify_*` granted to `authenticated` + gated on
`org_member_can(..., 'settings')`.

### Future direction (NOT this pass): a public "Anemalo Connect" SDK

A small JS package a breeder drops into a hand-built site to pull their own published
dogs/litters/puppies from `api.anemalo.com` — read-only, org-scoped. Roadmap P7.

**What v1 of the gateway must not preclude** (and currently doesn't):

- **A stable, versioned contract** — the `/v1/*` prefix and the `SiteContentResponse` shape are
  the contract; breaking changes go to `/v2`. Keep the response additive.
- **A public org identifier that is not the internal uuid** — the gateway already accepts and
  returns `slug`. The SDK keys on `slug` (or a future opaque `public_key`), never
  `organisations.id`. Don't leak the uuid as the primary handle.
- **Per-origin CORS from `organisation_domains`** — `Env.ALLOWED_ORIGINS` + the `Vary: Origin`
  branch already exist in `gateway/src/lib.ts` as the seam; P6 wires it to the verified-domain
  list so a breeder's SDK calls are allowed from their own origin specifically (and abusive
  origins can be cut off) without opening a write surface.
- **No write surface on the anon tier** — the SDK stays read-only; `POST /v1/enquiry` is the only
  write and it's rate-limited and single-purpose.

---

## 9. Phased roadmap

Each phase is independently shippable.

| Phase | Deliverable | Depends on | Migrations? |
|---|---|---|---|
| **P1** | Gateway Worker skeleton + `GET /v1/site-content` (reading existing `public_*` views / anon-safe columns) + `GET /health`. Deploy to `api.anemalo.com`, add Cloudflare Rate Limiting rules. | — (skeleton already boot-tested in `../gateway/`) | none |
| **P2** | Breeder `team.tsx` (mirror foundation) + nav entry + `canAddTeamMembers` gate. Then the `org_member_can()` helper + re-`CREATE POLICY` for items 1–13 (§5) + `enforce_publish_capability` trigger + `npm run test:db` RLS coverage. | P1 not required; independent | **yes** — §5 list |
| **P3** | Admin onboarding: `admin_create_kennel()` RPC + `approve_user_verification()` seeds site config + `admin/onboard-breeder` screen. | P2's `org_member_can` (so a seeded team works) | **yes** — §6 |
| **P4** | `scripts/import-gryfin.ts` (dry-run first) + the Gryfin owner `auth.users`/`profiles`/`organisation_members` rows. | P3 (`admin_create_kennel`), `organisation_enquiries` optional | none (data only; maybe `external_ids` staging) |
| **P5** | Fork `/p/grif/p` → reads `api.anemalo.com/v1/site-content?org=gryfin`, no `@supabase/supabase-js`. Wire `submitEnquiry` → `/v1/enquiry`. | P1, P4 (real Gryfin data to render), P-enquiry for the form | none |
| **P6** | Custom-domain resolution: `resolve_org_by_hostname()` + `get_org_primary_hostname()` RPCs, `GET /v1/resolve-domain` goes live, TXT-verify flow (`verify_org_domain()` + gateway `POST /v1/verify-domain` + Cron re-check), breeder "Domains" settings card, SEO canonical wiring on `anemalo.com/breeders/<slug>`, per-origin CORS from `organisation_domains`. | P1, P2 (`org_member_can('settings')`) | **yes** — §8 RPCs |
| **P7** | `POST /v1/enquiry` backend: `organisation_enquiries` table + `submit_org_enquiry()` + IP rate-limit table; leads surface in the breeder dashboard. Then (separately) the public **Anemalo Connect SDK** package + docs. | P1; dashboard leads view needs P2 gates | **yes** — §2 |

Ordering rationale: P1 ships value immediately against data that already exists. P2 unblocks every
"a team can actually run the kennel" story and is the load-bearing RLS work. P3–P4 get real
tenants in. P5 proves the whole loop with Gryfin. P6–P7 are the polish that makes it a product
(own domains, lead capture, SDK).

---

## 10. Open questions / risks — answer before P1 starts

1. **Cross-tenant RLS audit.** Every table the gateway reads must be *provably* org-safe. §2
   lists the seven and their policies as they stand today — but a formal pass is needed:
   `run get_advisors` (security lints), plus a `npm run test:db` case that logs in as org A's
   owner, hits `/v1/site-content?org=<B>` semantics (anon), and asserts zero of B's unpublished
   rows leak. **Does `public_dogs` filter by kennel visibility, or does it expose every pedigree
   identity regardless of the owning kennel's `is_public`?** Confirm before P1 — if it's the
   latter, `site-content` should read `parent_dogs` (which *is* correctly gated) instead.
2. **`resolve_org_by_hostname` shape.** Confirm it should be an `anon`-granted `SECURITY DEFINER`
   RPC (this plan's assumption) vs. a `wrangler secret` service-role read vs. a new
   `public_active_domains` view. The RPC keeps the "no service-role in the Worker" rule intact —
   get sign-off.
3. **The ksef-ai reference gap is now closed** — `/mnt/c/k/ksef-ai/supabase/functions/` was read
   (§3). But those are **Deno edge functions behind** `api.ksiegai.pl`; Anemalo's plan is a Worker
   talking to PostgREST/RPC directly. Confirm the product owner is fine with that deviation (no
   edge-function hop) rather than a 1:1 copy.
4. **Rate limiting owner.** Cloudflare Rate Limiting rules (dashboard, no code) vs. a KV/DO
   counter in the Worker. Pick before P1 deploy — the endpoint is anonymous and world-reachable.
5. **`organisations.plan` gating.** Is `site-content` served for a `free`-plan kennel, or is a
   public custom site a `pro`/`website` capability? `getKennelCapabilities` says custom domains
   are `pro`+ but says nothing about the gateway read itself. Decide whether `/v1/site-content`
   checks `plan` (and returns 402/404 for `free`) or is always open (discovery benefits from open).
6. **Suspended org behaviour.** With today's RLS, suspending an org (`verification_status` ≠
   `approved` or `is_public=false`) makes `/v1/site-content` 404 automatically — the breeder's
   whole site goes dark. Is a "temporarily unavailable" holding state wanted instead (a
   `status='suspended'` in the payload the template app renders as a soft page)? That needs a
   dedicated anon-readable status signal, since the org row itself becomes invisible.
7. **Slug stability & collisions.** `approve_user_verification` builds slugs as
   `slugify(name) || '-' || left(id,8)`; `admin_create_kennel` should match. The public SDK/domain
   contract keys on `slug` — is a slug immutable once issued? If a breeder renames the kennel, the
   old slug must keep resolving (redirect) or external embeds break.
8. **Media origin.** Seed data uses relative `/images/...` paths. Confirm the real
   storage/CDN base URL the gateway should prefix (or that `animal_images.image_url` is always
   stored absolute) before P5 — the template app can't guess.
9. **`testimonials` / reviews.** `docs/SOCIAL_DOMAIN.md` lists a reviews section but there's no
   table. Gryfin has ~real testimonials to import (P4). Decide: new `organisation_reviews` table,
   or fold into the social `posts` domain with a `review` post type?
10. **Auth for breeder *panel* on a breeder domain.** This plan covers the *public read* site. The
    TODO also imagines the breeder logging into "their" site. Decision (brief item 2) is that the
    breeder uses the **Anemalo dashboard** (`dashboard.breeder.*`) with their Anemalo account —
    there is no separate per-domain admin app. Confirm that's still the intent (it avoids a second
    auth surface entirely).
