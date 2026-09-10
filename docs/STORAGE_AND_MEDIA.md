# Storage & media

Status (2026-09-10): **all file storage is Supabase Storage today.** Cloudflare R2 is a real,
intended future move — this doc is the "prepare to integrate" groundwork: one seam to change later
instead of a scattered rewrite. R2 is NOT wired up. The bucket *strategy* is decided (reuse
`gryfinyork-media` behind `media.anemalo.com` — see "Decided direction" below), but no Anemalo-side
R2 binding, custom domain, or `upload-media` function exists, and `src/lib/storage/media.ts` still
calls Supabase Storage everywhere. The Gryfin data migration (`docs/GRYFIN_IMPORT.md`) deliberately
does NOT depend on any of this — it stores Gryfin's existing public image URLs as-is.

## Current buckets (all `supabase/migrations/*.sql`)

| Bucket | Public? | Purpose | Path convention |
|---|---|---|---|
| `kennel-media` | public | logos, covers, parent-dog/animal photos | `{org_id}/...` |
| `transport-documents` | private | passport scans, health certificates | `{transport_request_id}/...` |
| `transport-evidence` | private | pickup/delivery photo evidence | `{transport_request_id}/...` |
| `message-attachments` | private | conversation attachments | `{conversation_id}/...` |
| `welfare-case-documents` | private | welfare-case supporting documents | `{welfare_case_id}/...` |
| `pickup-delivery-evidence` | private | handover evidence | see `20260101010000_pickup_delivery_evidence.sql` |
| `post-media` | public | community post images | see `20260903000600_post_media.sql` |

`kennel-media` and `post-media` have RLS policies but, as of 2026-09-09, **no real upload UI calls
them yet** — animal/post images are still seeded as plain URLs (confirmed by grep: zero
`.upload(` call sites reference either bucket). The four private buckets *do* have real upload flows
(transport documents, transport evidence, message attachments, welfare-case documents).

## The abstraction: `src/lib/storage/media.ts`

Every real upload call site now goes through this module instead of calling `supabase.storage`
directly — `uploadPrivateFile` / `removeFile` / `getSignedFileUrl` for the four private buckets
above (all four call sites migrated to it 2026-09-09; previously each one duplicated an identical
`sanitizeFilenameForStoragePath` + inline `supabase.storage.from(...).upload()`/`.remove()`/
`.createSignedUrl()` block), plus `uploadPublicFile` / `getPublicFileUrl` ready for whenever
`kennel-media`/`post-media` (or a future puppy-photo-diary bucket) get a real upload UI.

**Why this matters for R2**: today every function in `media.ts` calls Supabase Storage
(`getSupabaseBrowserClient().storage...`). Moving a bucket to R2 later is a change *inside this one
file* — swap the relevant function's implementation to call an R2-backed Edge Function instead —
rather than hunting down and rewriting every domain service that currently uploads a file. Any new
upload feature should be added to `media.ts`, not as another ad hoc `supabase.storage` call site,
or this stops being true.

## The R2 migration path, when it actually happens

Reference implementation to follow: the Gryfin York breeder panel (`/p/grif/c`) already does
exactly this in production —

- `src/lib/r2.ts` never talks to R2 directly from the browser. It calls a **Supabase Edge
  Function** (`upload-media`) over `fetch`, authenticated with the caller's Supabase session
  `access_token` as a Bearer header.
- The Edge Function is the only thing holding R2 credentials (an R2 binding on a separate
  Cloudflare Worker, `media-worker/`, bucket `gryfinyork-media`) — never shipped to the browser.
- Client-side image compression (`compressImage.ts`) and HEIC conversion happen *before* the
  upload request, same as any Supabase Storage upload would need.

Applying that here: add an `upload-media` Supabase Edge Function (mirroring
`create-deposit-checkout-session`'s shape — verify the caller, do the privileged work server-side)
in front of an R2 bucket bound to a Cloudflare Worker, then change `uploadPrivateFile`/
`uploadPublicFile`/`getSignedFileUrl`/`getPublicFileUrl` in `media.ts` to call it instead of
`supabase.storage`. This can be done **bucket by bucket** — `media.ts` already takes a `bucket`
argument, so nothing stops e.g. moving `kennel-media` to R2 first while `transport-documents` stays
on Supabase Storage, if that's ever the right order.

## Addressing model + bucket (2026-09-11) — `docs/BREEDER_SITE_SDK.md` Part A is authoritative

Settled alongside the breeder-site SDK. Short version:

- **Own bucket: `anemalo-media`** (a fresh R2 bucket), custom domain `media.anemalo.com` attached
  **directly** (R2 public custom domain, no Worker). *Reverses* the 2026-09-10 "reuse Gryfin's
  bucket" line below — a breeder's bucket name as the platform store is confusing forever and
  can't be lifecycled independently, and the only saving (no object copy) is ~85 tiny objects.
- **A media ref is a relative key OR a full URL.** Image columns (`animal_images.image_url`,
  `parent_dogs`/`dogs.profile_image_url`, `organisations.logo_url`/`cover_image_url`) hold either
  `org/<org_id>/<kind>/<uuid>.<ext>` (→ resolved `https://media.anemalo.com/<key>`) or an absolute
  `https://…` URL (→ used verbatim). Resolver: `ref.startsWith("http") ? ref : BASE + "/" + ref`.
- **No schema migration, no per-org `media_base_url`.** One platform base for everyone. GRYFIN's
  imported `https://media.hodowlagryfinyork.pl/...` rows are the pass-through case — unchanged,
  still working. Optional later: `rclone` her ~85 objects into `anemalo-media/org/<id>/legacy/…`
  and `regexp_replace` those rows to keys.
- **Gryfin untouched**: her `gryfinyork-media` bucket, `media-worker`, and
  `media.hodowlagryfinyork.pl` stay exactly as they are.
- Write path = a **new `upload-media` Supabase Edge Function on the Anemalo project** (verifies
  `is_org_member`, writes to `anemalo-media` via R2 S3 API), not Gryfin's single-tenant one.
- `media_assets` table = deferred; the ref convention is forward-compatible.

Phasing (S0/S1/S6) and the full rationale: `BREEDER_SITE_SDK.md` §A.2–A.5 + phase table.

## Superseded — "reuse Gryfin's bucket behind a custom domain" (2026-09-10)

> Kept for the record. Replaced by "Own bucket: `anemalo-media`" above on 2026-09-11.

Reuse the existing `gryfinyork-media` R2 bucket as Anemalo's media bucket, put a Cloudflare custom
domain in front of it, namespace future breeders' objects under `org/<organisation_id>/…`, no
object copy. Rejected at the time: a fresh `anemalo-media` bucket + an R2→R2 copy of every Gryfin
object. — Reversed because the copy is trivial at this scale and the shared-bucket downsides
(naming, lifecycle, token scope, billing) outweigh it.

## Explicitly not done yet

- `anemalo-media` bucket not created; `media.anemalo.com` not connected to it (it's currently
  mis-routed to the `anemalo-gateway` Worker — every image path 404s).
- No `upload-media` Edge Function on the Anemalo project.
- `src/lib/storage/media.ts` still points every function at Supabase Storage.
- No decision on which buckets move first, or whether all of them eventually do (the public
  `kennel-media` / `post-media` are the obvious first candidates — they have no real upload flow
  yet, so there's nothing to migrate, only to point at R2 from day one).
- No signed-URL-from-R2 equivalent designed (R2 has its own presigned-URL mechanism, not
  identical to Supabase Storage's `createSignedUrl` — needs its own short design pass when this is
  actually built, not assumed to be a drop-in swap). Only relevant for the *private* buckets;
  the public ones just need the custom-domain base URL.
