// Reusable pipeline steps. A route opts into exactly the ones it needs.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { err } from "./cors.ts";
import type { PipelineStep } from "./types.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Any active org member may act, except roles that are read-only or unrelated to content
// management. Widen/narrow per-route later if a verb needs a stricter role.
const CONTENT_DENIED_ROLES = new Set(["viewer", "driver"]);

/** Require a valid Supabase session. Sets ctx.userId + ctx.rls (RLS-scoped client). */
export const requireAuth: PipelineStep = async (ctx) => {
  const authHeader = ctx.req.headers.get("Authorization") ?? "";
  if (!authHeader) return err(ctx.req, 401, "Missing Authorization header");

  const rls = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
    error,
  } = await rls.auth.getUser();
  if (error || !user) return err(ctx.req, 401, "Not authenticated");

  ctx.userId = user.id;
  ctx.rls = rls;
};

/**
 * Require the caller to be an active, content-capable member of `body.orgId`.
 * Sets ctx.orgId + ctx.membership. Must run AFTER requireAuth.
 *
 * `organisation_members` RLS ("members read their own membership rows") returns only the
 * caller's own row, so this can't be used to probe another user's membership.
 */
export const requireOrgMember: PipelineStep = async (ctx) => {
  const orgId = String(ctx.body.orgId ?? "").trim();
  if (!UUID_RE.test(orgId)) return err(ctx.req, 400, "`orgId` must be a valid uuid");

  const { data, error } = await ctx.rls!
    .from("organisation_members")
    .select("member_role, status")
    .eq("org_id", orgId)
    .eq("profile_id", ctx.userId!)
    .maybeSingle();
  if (error) {
    console.error(`[${ctx.action}] membership lookup failed`, error);
    return err(ctx.req, 500, "Could not verify organisation membership");
  }
  if (!data || data.status !== "active" || CONTENT_DENIED_ROLES.has(data.member_role)) {
    return err(ctx.req, 403, "You do not have permission to act on this organisation");
  }

  ctx.orgId = orgId;
  ctx.membership = data;
};
