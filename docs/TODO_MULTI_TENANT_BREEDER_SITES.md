# TODO — Multi-tenant breeder websites on the Anemalo database

Status: **idea captured 2026-09-09, not yet investigated or scoped.** Written down verbatim from
the user's own framing so it isn't lost; needs a real architecture pass against `/p/grif` (an
existing single-breeder site + its own Supabase project) before any of this is designed for real.

## The idea

- Anemalo becomes the **shared database** behind a family of individual breeder websites, not just
  its own marketplace.
- Reference case: `/p/grif` (Gryfin) — a real breeder site today with its **own** Supabase project.
  Its public site pulls litters/puppies from its own panel. Study exactly how its breeder panel and
  its public page are wired together before designing the shared version.
- Target model: instead of standing up a brand-new Supabase project per breeder site (each one
  eating its own free-tier allowance), **new breeder sites run on the Anemalo database**:
  - The breeder gets their own login for *their* breeder website.
  - That login/session works against the **Anemalo** Supabase project — Anemalo becomes identity +
    data for every breeder site, not a separate silo per breeder.
  - The breeder management panel (add miot/litter, add puppies, mark for reservation, etc.) is the
    **same panel behavior as Gryfin's**, but backed by Anemalo's schema (`litters`, `animals`,
    `reservations`, ...) instead of a bespoke per-breeder schema.
  - Each breeder's **public website** (their own domain/branding) reads its animals/litters straight
    out of Anemalo, scoped to that breeder's `organisation_id` — so anything a breeder adds in their
    panel shows up both on their own branded site *and* inside Anemalo's own marketplace, from one
    write.
- Business model implication: instead of each breeder effectively getting a full free Supabase
  project, monetize this as a **subscription** priced around how much of Anemalo they use (storage,
  listings, features), since the underlying infrastructure cost is shared/pooled across breeders
  rather than duplicated per site.
- End goal: a **repeatable system to spin up a new breeder's site quickly** — a template/starter
  that just needs branding + an `organisation_id` to point at, not a bespoke build per breeder.

## `/p/grif` reviewed 2026-09-09 — this is the exact pattern to generalize

Gryfin York (Yorkshire terrier kennel, Łódź) is **two separate repos, two separate Cloudflare Worker
deployments, one shared Supabase project** (`eqggerrzfwlfqibcdyjy`):

- **`c/` (panel)** — `gryfin-york-panel` repo. Real breeder admin: email/password auth
  (`supabase.auth.signInWithPassword`), direct `supabase-js` CRUD against `dogs` / `litters` /
  `puppies` / `testimonials` / `enquiries` / `gallery_images` / `site_settings` (one singleton
  settings row, `id=1`). Row↔domain mapping centralized in one file (`src/lib/dbMapping.ts`) that's
  manually kept in sync with the schema. Media upload does **not** use Supabase Storage — a Supabase
  Edge Function (`upload-media`) proxies to a separate Cloudflare R2 bucket (`gryfinyork-media`,
  bound in its own `media-worker/` Worker).
- **`p/ (public site)`** — `gryfinyork-magical-world` repo, Polish marketing site. **Zero
  `@supabase/supabase-js` dependency.** Everything it shows comes from exactly one Edge Function,
  `get-site-content`, which aggregates dogs/litters/puppies/testimonials/gallery/settings into one
  JSON payload in a single request (`useSiteContent()` → `useSuspenseQuery`, 60s staleTime, loaded
  in the root route loader). Writes go through a second function, `submit-enquiry` (contact-form
  lead capture). No auth of any kind in this app — it's a pure read model / BFF over the panel's
  data, never touching Postgres directly.
- Both apps only share the Supabase project via `VITE_SUPABASE_URL` / `VITE_SUPABASE_FUNCTIONS_URL`
  env vars — there is no other coupling. This is a genuinely clean template: **one write-capable
  admin app + one read-only public app talking through a small, deliberate Edge Function API**, not
  each site hitting Postgres with its own ad hoc query shape.

### How this maps onto Anemalo as the shared DB

This single-tenant pattern (one kennel, one Supabase project) generalizes to Anemalo's
already-multi-tenant schema reasonably directly:

- `c/`'s tables (`dogs`, `litters`, `puppies`) map onto Anemalo's existing `parent_dogs` / `litters`
  / `animals` (which already has `organization_id` + RLS via `owns_org()`) — a breeder's panel
  becomes "the existing Anemalo breeder dashboard, scoped to their org," not a new schema.
  `testimonials`/`enquiries`/`gallery_images` map onto `animal_images` +
  (loosely) `buyer_applications`/`reports`; `site_settings` has no Anemalo equivalent yet — would
  need a real `organisation_site_settings` (or extend `organisations`) table for per-breeder
  branding (logo, colors, About text, custom domain).
- `p/`'s pattern is the important one to copy exactly: **a new breeder public site should be a thin
  template app with no direct Supabase client**, reading through one aggregation Edge Function (an
  Anemalo equivalent of `get-site-content`, parameterized by `organisation_id` — e.g.
  `get-org-site-content?org=<id>`) rather than a per-site bespoke query layer. That keeps every
  breeder site's public surface consistent, keeps RLS/anon-safety in exactly one audited place
  (the function), and is what actually makes "spin up a new site quickly" possible — the template
  app only ever needs an `organisation_id` + branding config, never new backend code per breeder.
- `organisation_domains` (already schema-only/inert in Anemalo per `docs/DEFERRED_BACKEND.md`) is
  exactly the piece needed for each breeder's own custom domain — this idea is the real reason to
  finally build it out.

## What still needs a real decision before building

1. Multi-tenant RLS shape: confirm every table a breeder site's Edge Function reads from is safe to
   aggregate cross-org-scoped by `organisation_id` alone (no leakage of another org's data) — this
   is the load-bearing risk, not a detail. `owns_org()` already exists for the panel side; the
   public aggregation function needs its own careful anon-safe column selection, same posture as
   Anemalo's existing `public_transport_requests` / `public_fundraising_totals` views.
2. Per-breeder branding/theme config — new table, or an extension of `organisations`.
3. Template mechanics: what's a one-time "new breeder site" setup script actually do (create org,
   seed `organisation_site_settings`, register domain, deploy Worker) vs. what's genuinely templated
   code shared across every site.
4. Pricing model: replaces "each breeder gets their own free Supabase project" with a subscription
   sized to their usage of the shared Anemalo project — needs real tiers, not just the framing.
5. Only after 1–3 are actually scoped: start building.

See also `docs/RESERVATION_PAYMENT_DESIGN.md` for unrelated, already-in-progress work on the same
codebase (Stripe zaliczka deposits) — no dependency between the two, noted only so both threads are
visible in one place.
