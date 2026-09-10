# Edge function architecture

Status: **live, 2026-09-11.** Converging on the ksef-ai / `ksiegai-workspace` shape (one function
per *trust tier*, `action: "<domain>.<verb>"` dispatch, per-route pipeline), adapted to Anemalo's
"RLS is the boundary, the app writes directly" design.

## Tiers

| Tier | Where | Auth | Holds secrets? | Examples |
|---|---|---|---|---|
| **Anonymous read** | `api.anemalo.com` — the **`anemalo-gateway`** Cloudflare Worker (own repo `/p/anemalo/gateway`) | none (anon key + RLS + `public_*` views) | no | `/v1/site-content`, `/v1/resolve-domain`, `/v1/enquiry` |
| **Authenticated ops** | **`anemalo-workspace`** Supabase Edge Function | Supabase user JWT (`verify_jwt`) **+** per-route `requireAuth` / `requireOrgMember` | yes (R2, later Stripe) | `media.upload`, `media.delete` |
| **Webhook** | **`stripe-webhook`** Supabase Edge Function | Stripe signature only — no CORS, no JWT, never echoes the permissive CORS header | yes (`STRIPE_WEBHOOK_SECRET`) | Stripe events |
| **Direct RLS write** | the app itself, `supabase-js` | user JWT + Postgres RLS | no | create/edit a litter, dog, profile, application, … — **the default** |
| Scheduled / worker | *(none yet)* | — | — | future: reminders, digest emails |

### What goes in `anemalo-workspace` vs. stays a direct client write

**Default: a direct RLS-gated `supabase-js` write from the app.** Anemalo deliberately makes RLS
the access boundary (see `CLAUDE.md`, `docs/DOMAIN_MODEL.md`) — ordinary CRUD does **not** get an
edge function, and routing it through one would only add latency and a rewrite for no safety gain.

An operation belongs in `anemalo-workspace` only when a plain client write **can't** do it:

1. it needs a **secret** the browser must never hold (R2 keys, Stripe secret key);
2. it needs a **service-role elevation** past a protective trigger (cf.
   `create-deposit-checkout-session` writing `reservations.stripe_checkout_session_id`, which
   `prevent_client_writes_to_deposit_payment_fields()` blocks for the `authenticated` role);
3. it calls an **external API** (R2 S3, Stripe, a future POK connector);
4. it needs **atomic multi-step server logic** that a single RLS'd statement or one RPC can't express.

If none of those apply, it's a client write. This keeps the function small on purpose.

`stripe-webhook` stays its own deployment (webhook tier — different auth, no CORS). `create-deposit-checkout-session`
is pre-existing and stays as-is for now; fold it into `anemalo-workspace` as `payments.createDepositCheckout`
when the reservation UI is next touched (it has a live call site — not a free move).

## `anemalo-workspace` layout

Mirrors `ksiegai-workspace`:

```
supabase/functions/
  _shared/
    r2.ts                       # S3/SigV4 R2 client (aws4fetch) — shared infra
    workspace/
      cors.ts                   # buildCorsHeaders / corsPreflight / jsonResponse / ok / err
      parseRequest.ts           # tolerant parse: JSON *and* multipart -> { action, body, file }
      types.ts                  # WorkspaceContext, ComposedRoute, AuditSpec, PipelineStep
      steps.ts                  # requireAuth, requireOrgMember  (opt-in per route)
      composePipeline.ts        # steps -> handler -> (2xx) audit -> response ; catch -> onError
      audit.ts                  # writeAuditLog -> public.audit_logs (service role)
  anemalo-workspace/
    index.ts                    # Deno.serve; OPTIONS; POST only; parse; split action; dispatch
    router.ts                   # domain -> sub-router
    domains/
      media/
        media.router.ts         # verb -> route
        routes/
          upload.route.ts       # ComposedRoute { steps, handler, onError, audit }
          delete.route.ts
```

- **Action**: `POST`, body carries `action: "<domain>.<verb>"` (JSON) or an `action` form field
  (multipart). `index.ts` splits it; unknown domain/verb → `400 {ok:false, code:"unknown_action"}`.
- **Response envelope**: `{ ok: true, ... }` / `{ ok: false, error, code? }`.
- **A route is a `ComposedRoute`**: `steps` (auth/access, opt-in), `handler` (the logic),
  `onError` (per-route error→Response), optional `audit` (see below). `composePipeline` chains them.
- **Clients**: `ctx.rls` (anon key + caller JWT — RLS is the check for every query with it) vs.
  `ctx.service` (service role — audit writes and deliberate, documented elevations only).
  `requireAuth` sets `ctx.userId` + `ctx.rls`; `requireOrgMember` reads `body.orgId`, checks an
  **active, content-capable** `organisation_members` row, sets `ctx.orgId` + `ctx.membership`.
  `verify_jwt` alone only proves a token is valid — the steps prove *what it may touch*.

## Events

**Every mutating verb records one `public.audit_logs` row**
(`actor_profile_id, action, target_type, target_id, before, after, created_at`; `profiles.id ==
auth.users.id`). A route declares an `audit(ctx, response)` returning an `AuditSpec` (or `null` to
skip). `composePipeline` writes it **after a 2xx**, with the **service-role** client (audit rows
are system-written, same as the DB triggers that also insert there).

**Best-effort, not transactional.** A side effect that already happened (an R2 object is stored)
must not be rolled back by a failed audit insert — `composePipeline` swallows the audit error and
logs it loudly (`AUDIT WRITE FAILED (op still succeeded)`). If a verb ever needs a guaranteed
event, it must write the audit row *inside the same DB transaction as its own mutation* (an RPC),
not rely on this hook.

User-facing notifications are a separate concern: call `create_notification_if_enabled(...)` from
the handler where a person should be told something (not every audit row warrants a notification).

Reserved `composePipeline` slots, not built: **rate limiting** (`enforce_rate_limit()` is a no-op
for anon and edge functions are authed here, so it's usable — wire it when a verb needs it; see
`docs/RATE_LIMITING_AND_ABUSE_PROTECTION.md`) and **idempotency keys**.

## The gateway ↔ workspace relation

Breeder public sites (no `supabase-js`) reach `api.anemalo.com` only. If they ever need an authed
write (a logged-in breeder editing from their own domain), add a `POST /v1/workspace` **proxy**
route on the gateway Worker that forwards to `anemalo-workspace` — one hostname, one rate-limit
tier. The main Anemalo app skips the hop and calls `supabase.functions.invoke("anemalo-workspace", …)`
directly. Not built yet.

## Deployed

| Function | Tier | `verify_jwt` | State |
|---|---|---|---|
| `anemalo-workspace` | authenticated ops | true | live; `media.*` returns 503 until the `R2_*` secrets are set (`supabase/functions/anemalo-workspace/README.md`) |
| `create-deposit-checkout-session` | authenticated ops (pre-dating this doc) | true | live; 503 until `STRIPE_SECRET_KEY` set. Migrate to `anemalo-workspace` later. |
| `stripe-webhook` | webhook | false (signature auth) | live; 503 until `STRIPE_WEBHOOK_SECRET` set |

The short-lived standalone `media` function (deployed then folded into `anemalo-workspace` the
same day) is superseded — delete it: `supabase functions delete media --project-ref pgzvkkybqrhxedjoyjzy`.
Nothing calls it.
