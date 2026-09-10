// media — the breeder-media domain function. One Supabase Edge Function that owns every write to
// the public `anemalo-media` R2 bucket (upload + delete). Action-dispatched rather than a
// function per verb, since the surface is small and cohesive (docs/BREEDER_SITE_SDK.md Part A /
// §3 of docs/API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md on when to use action-dispatch).
//
// This is the ONLY thing that can write to `anemalo-media` — the R2 credentials live here as
// Edge Function secrets and are never shipped to a browser. R2 has no RLS; this function *is* the
// authorization layer for the bucket:
//   1. valid Supabase JWT (verify_jwt is on by default too)
//   2. caller is an active, non-viewer member of the target org
//   3. the object key is DERIVED from the verified org id — client-supplied paths are ignored,
//      so a member of org A can never write into org B's prefix
//
// Reads need none of this — `media.anemalo.com` serves the bucket directly (public), no function.
//
// Secrets required (see ../_shared/r2.ts). Until they're set this returns a clean 503.
//
// Requests (POST only):
//   multipart/form-data:  action=upload, orgId=<uuid>, kind=<dog|puppy|gallery|logo|cover|post>,
//                         file=<binary>            -> { ref, url, bytes, contentType }
//   application/json:      { action: "delete", orgId: <uuid>, ref: "org/<orgId>/..." }
//                                                  -> { ok: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getR2Config, publicUrl, r2DeleteObject, r2PutObject } from "../_shared/r2.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const KINDS = new Set(["dog", "puppy", "gallery", "logo", "cover", "post"]);

// Any active member may manage the kennel's public photos — except roles that are explicitly
// read-only or unrelated to content. Tighten here if needed later.
const DENIED_ROLES = new Set(["viewer", "driver"]);

const EXT_BY_TYPE: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/avif": "avif",
  "image/gif": "gif",
};

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB — the panel compresses client-side well below this
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const r2 = getR2Config();
  if (!r2) {
    return json(
      { error: "Media storage is not configured yet (R2 secrets missing on this project)." },
      503,
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Not authenticated" }, 401);

  // ---- parse request ----------------------------------------------------------------------------
  const contentType = req.headers.get("content-type") ?? "";
  let action: string;
  let orgId: string;
  let kind: string | null = null;
  let ref: string | null = null;
  let file: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return json({ error: "Invalid multipart body" }, 400);
    action = String(form.get("action") ?? "upload");
    orgId = String(form.get("orgId") ?? "");
    kind = form.get("kind") ? String(form.get("kind")) : null;
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } else {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);
    action = String((body as Record<string, unknown>).action ?? "");
    orgId = String((body as Record<string, unknown>).orgId ?? "");
    ref = (body as Record<string, unknown>).ref ? String((body as Record<string, unknown>).ref) : null;
  }

  if (!UUID_RE.test(orgId)) return json({ error: "`orgId` must be a valid uuid" }, 400);

  // ---- authorize: active, non-read-only member of this org ------------------------------------
  // `organisation_members` RLS ("members read their own membership rows") returns the caller's
  // own row only, so this can't be used to probe another user's membership.
  const { data: membership, error: memErr } = await userClient
    .from("organisation_members")
    .select("member_role, status")
    .eq("org_id", orgId)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (memErr) {
    console.error("membership lookup failed", memErr);
    return json({ error: "Could not verify organisation membership" }, 500);
  }
  if (!membership || membership.status !== "active" || DENIED_ROLES.has(membership.member_role)) {
    return json({ error: "You do not have permission to manage this organisation's media" }, 403);
  }

  const prefix = `org/${orgId}/`;

  // ---- delete ---------------------------------------------------------------------------------
  if (action === "delete") {
    if (!ref || !ref.startsWith(prefix) || ref.includes("..")) {
      return json({ error: "`ref` must be an object path inside this organisation" }, 400);
    }
    try {
      await r2DeleteObject(r2, ref);
    } catch (err) {
      console.error(err);
      return json({ error: "Delete failed" }, 502);
    }
    return json({ ok: true });
  }

  // ---- upload --------------------------------------------------------------------------------
  if (action !== "upload") return json({ error: `Unknown action "${action}"` }, 400);
  if (!kind || !KINDS.has(kind)) {
    return json({ error: `\`kind\` must be one of ${[...KINDS].join(", ")}` }, 400);
  }
  if (!file) return json({ error: "`file` is required" }, 400);
  if (file.size === 0) return json({ error: "`file` is empty" }, 400);
  if (file.size > MAX_BYTES) {
    return json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, 413);
  }
  const type = file.type || "application/octet-stream";
  const ext = EXT_BY_TYPE[type];
  if (!ext) {
    return json({ error: `Unsupported image type "${type}" (allowed: ${Object.keys(EXT_BY_TYPE).join(", ")})` }, 415);
  }

  const key = `${prefix}${kind}/${crypto.randomUUID()}.${ext}`;
  try {
    await r2PutObject(r2, key, await file.arrayBuffer(), type);
  } catch (err) {
    console.error(err);
    return json({ error: "Upload failed" }, 502);
  }

  return json({ ref: key, url: publicUrl(r2, key), bytes: file.size, contentType: type });
});
