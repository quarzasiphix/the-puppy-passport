// anemalo-workspace — the authenticated, org/user-scoped operations tier.
//
// One Supabase Edge Function for everything a signed-in user does that a plain RLS-scoped
// client write CAN'T do on its own: an operation needing a secret (R2, Stripe), a service-role
// elevation past a protective trigger, an external API call, or atomic multi-step server logic.
// Ordinary CRUD stays a direct RLS-gated supabase-js write from the app — it does NOT come here.
// Full boundary + rationale: docs/EDGE_FUNCTION_ARCHITECTURE.md.
//
// NOT here: anonymous reads (api.anemalo.com gateway), webhooks (stripe-webhook), admin-only ops.
//
// Convention: POST, `action: "<domain>.<verb>"` (e.g. "media.upload"). JSON or multipart body.
// Response envelope: { ok: true, ... } | { ok: false, error, code? }.
//
// verify_jwt = true. Every route additionally runs `requireAuth` (+ `requireOrgMember` where an
// org is involved) — verify_jwt alone only proves a token is valid, not who/what it may touch.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsPreflight, err } from "../_shared/workspace/cors.ts";
import { parseRequest } from "../_shared/workspace/parseRequest.ts";
import type { WorkspaceContext } from "../_shared/workspace/types.ts";
import { dispatch } from "./router.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsPreflight(req);
  if (req.method !== "POST") return err(req, 405, "Method not allowed");

  const { action, body, file } = await parseRequest(req);
  const dot = action.indexOf(".");
  if (dot <= 0 || dot === action.length - 1) {
    return err(req, 400, `Unknown or missing action: "${action}"`, "unknown_action");
  }
  const domain = action.slice(0, dot);
  const verb = action.slice(dot + 1);

  const service = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const ctx: WorkspaceContext = { req, action, domain, verb, body, file, service };
  return dispatch(ctx);
});
