# `anemalo-workspace` edge function

The **authenticated operations tier** — one function for everything a signed-in user does that a
plain RLS-scoped `supabase-js` write can't (needs a secret, a service-role elevation, an external
API, or atomic multi-step logic). Ordinary CRUD stays a direct client write. Tier model + the
"what belongs here" boundary: `docs/EDGE_FUNCTION_ARCHITECTURE.md`.

Deployed on the Anemalo project (`pgzvkkybqrhxedjoyjzy`), `verify_jwt = true`.

## Call it

```
POST /functions/v1/anemalo-workspace
Authorization: Bearer <supabase user JWT>
```

`action: "<domain>.<verb>"` in a JSON body, or as an `action` form field for multipart.
Response: `{ ok: true, ... }` | `{ ok: false, error, code? }`.

```ts
// JSON verb
await supabase.functions.invoke("anemalo-workspace", {
  body: { action: "media.delete", orgId, ref: "org/…/gallery/….webp" },
});

// multipart verb (file upload) — build FormData yourself
const fd = new FormData();
fd.append("action", "media.upload");
fd.append("orgId", orgId);
fd.append("kind", "puppy");
fd.append("file", compressedBlob, "photo.webp");
await supabase.functions.invoke("anemalo-workspace", { body: fd });
```

## Domains

### `media` — writes to the public `anemalo-media` R2 bucket

Needs the R2 secrets (see `../_shared/r2.ts`) — returns **503** until they're set.

| verb | body | → |
|---|---|---|
| `media.upload` | multipart `orgId`, `kind` (`dog\|puppy\|gallery\|logo\|cover\|post`), `file` (`image/webp\|jpeg\|png\|avif\|gif`, ≤ 15 MB) | `{ ok, ref, url, bytes, contentType }` |
| `media.delete` | json `orgId`, `ref` (must be inside `org/<orgId>/`) | `{ ok: true }` |

`ref` = `org/<orgId>/<kind>/<uuid>.<ext>` — built from the **verified** `orgId`, so a member of
one org can't write into or delete from another's prefix. Store `ref` in the DB column; the public
URL is `media.anemalo.com/<ref>` (computed on read). Each verb writes an `audit_logs` row.

## Auth per route

`verify_jwt` proves the token is valid; the pipeline steps prove what it may touch:
`requireAuth` (→ `ctx.userId`, `ctx.rls`) then `requireOrgMember` (active `organisation_members`
row for `orgId`, role not `viewer`/`driver` → `ctx.orgId`, `ctx.membership`).

## Adding a verb

1. `domains/<domain>/routes/<verb>.route.ts` — export a `composePipeline(route)` where `route`
   is `{ steps, handler, onError, audit? }`.
2. wire it in `domains/<domain>/<domain>.router.ts` (and add the domain to `router.ts` if new).
3. redeploy the whole function.

## Not wired to the app yet

`src/lib/storage/media.ts` needs `uploadOrgMedia()` / `removeOrgMedia()` helpers that invoke this,
and the breeder-panel photo pickers need to use them (phase S6 in `docs/BREEDER_SITE_SDK.md`).
