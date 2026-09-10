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

## Decided direction (2026-09-10) — reuse Gryfin's bucket behind a custom domain

When the R2 pass happens, the bucket strategy is settled: **reuse the existing `gryfinyork-media`
R2 bucket as Anemalo's media bucket**, put a Cloudflare custom domain (`media.anemalo.com` /
`cdn.anemalo.com`) in front of it so the legacy bucket name is never publicly visible, and namespace
future breeders' objects under an `org/<organisation_id>/…` prefix. **No object copy** — Gryfin's
existing images are already in that bucket and keep serving unchanged; this is also why the Gryfin
data migration (see `docs/GRYFIN_IMPORT.md`) stores Gryfin's existing image URLs as-is rather than
re-hosting. Rejected alternative: a fresh `anemalo-media` bucket + an R2→R2 copy of every Gryfin
object — cleaner namespace but a needless one-time migration for zero real benefit once the custom
domain hides the name.

## Explicitly not done yet

- No R2 custom domain (`media.anemalo.com`) configured, no Worker binding to `gryfinyork-media`
  from the Anemalo side.
- No `upload-media` Edge Function on the Anemalo project.
- `src/lib/storage/media.ts` still points every function at Supabase Storage.
- No decision on which buckets move first, or whether all of them eventually do (the public
  `kennel-media` / `post-media` are the obvious first candidates — they have no real upload flow
  yet, so there's nothing to migrate, only to point at R2 from day one).
- No signed-URL-from-R2 equivalent designed (R2 has its own presigned-URL mechanism, not
  identical to Supabase Storage's `createSignedUrl` — needs its own short design pass when this is
  actually built, not assumed to be a drop-in swap). Only relevant for the *private* buckets;
  the public ones just need the custom-domain base URL.
