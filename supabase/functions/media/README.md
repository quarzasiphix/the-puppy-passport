# `media` edge function

The breeder-media **write** path — the only thing that can put/delete objects in the public
`anemalo-media` R2 bucket. Reads don't touch this: `media.anemalo.com` serves the bucket directly.
Design + rationale: `docs/BREEDER_SITE_SDK.md` Part A.

Deployed on the Anemalo project (`pgzvkkybqrhxedjoyjzy`), `verify_jwt = true`. Returns a clean
**503** until the R2 secrets below are set.

## Secrets (set on the Anemalo project)

| Secret | Value |
|---|---|
| `R2_S3_ENDPOINT` | `https://<account_id>.eu.r2.cloudflarestorage.com` (from the R2 API token screen) |
| `R2_ACCESS_KEY_ID` | R2 **Account** API token, permission *Object Read & Write*, scoped to bucket `anemalo-media` |
| `R2_SECRET_ACCESS_KEY` | — |
| `R2_BUCKET` | `anemalo-media` |
| `MEDIA_PUBLIC_BASE_URL` | *(optional)* default `https://media.anemalo.com` |

```bash
supabase secrets set --project-ref pgzvkkybqrhxedjoyjzy \
  R2_S3_ENDPOINT="https://<account_id>.eu.r2.cloudflarestorage.com" \
  R2_ACCESS_KEY_ID="..." R2_SECRET_ACCESS_KEY="..." R2_BUCKET="anemalo-media"
```

`SUPABASE_URL` / `SUPABASE_ANON_KEY` are auto-injected — don't set them.

## API

`POST /functions/v1/media`, `Authorization: Bearer <supabase user JWT>`.

**Upload** — `multipart/form-data`:

| field | |
|---|---|
| `action` | `upload` (default) |
| `orgId` | the kennel's `organisations.id` (uuid) |
| `kind` | `dog` \| `puppy` \| `gallery` \| `logo` \| `cover` \| `post` |
| `file` | the image — `image/webp\|jpeg\|png\|avif\|gif`, ≤ 15 MB (compress client-side first) |

→ `200 { ref, url, bytes, contentType }` where `ref` = `org/<orgId>/<kind>/<uuid>.<ext>` (store
this in the DB column) and `url` = `MEDIA_PUBLIC_BASE_URL/<ref>`.

**Delete** — `application/json`: `{ "action": "delete", "orgId": "<uuid>", "ref": "org/<orgId>/..." }`
→ `200 { ok: true }`. `ref` must be inside the caller's own `org/<orgId>/` prefix.

## Authorization

R2 has no RLS — this function is it:

1. valid Supabase JWT;
2. caller is an **active** `organisation_members` row for `orgId` whose `member_role` is not
   `viewer` / `driver`;
3. the object key is **built from the verified `orgId`** — a client can't smuggle a path into
   another org's prefix (upload), and delete is refused unless `ref` starts with `org/<orgId>/`.

## Not wired to the panel yet

Breeder-panel photo pickers still need to call this (phase S6 in `docs/BREEDER_SITE_SDK.md`), and
`src/lib/storage/media.ts` gets an `uploadOrgMedia()` / `removeOrgMedia()` seam alongside the
Supabase Storage helpers.
