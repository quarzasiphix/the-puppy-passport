import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  /**
   * Reserved for roadmap P6 (per-origin CORS sourced from `organisation_domains`). When unset the
   * gateway answers with `access-control-allow-origin: *`, which is acceptable for a public,
   * anon-safe read API. Comma-separated list of allowed origins when set.
   */
  ALLOWED_ORIGINS?: string;
}

/**
 * A per-request Supabase client bound to the ANON key. RLS is the access boundary — every table
 * this gateway reads has an `anon`-role SELECT policy that already restricts rows to
 * published + approved + public content (verified against the live project 2026-09-10). The
 * gateway never holds a service-role key.
 */
export function anonClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "x-anemalo-gateway": "v1" } },
  });
}

export function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  const allowList = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const allowOrigin =
    allowList.length === 0 ? "*" : origin && allowList.includes(origin) ? origin : allowList[0]!;

  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "86400",
    ...(allowList.length > 0 ? { vary: "Origin" } : {}),
  };
}

export function json(
  body: unknown,
  init: { status?: number; env: Env; origin: string | null; cache?: string },
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": init.cache ?? "no-store",
      "x-content-type-options": "nosniff",
      ...corsHeaders(init.env, init.origin),
    },
  });
}

export function errorBody(code: string, message: string, extra?: Record<string, unknown>) {
  return { error: code, message, ...extra };
}

/** PostgREST codes that mean "the RPC/relation this gateway expects does not exist yet". */
export function isMissingDbObject(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "PGRST202" || err.code === "42883" || err.code === "42P01") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("could not find the function") || m.includes("does not exist");
}
