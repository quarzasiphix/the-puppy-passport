import "./app/error-capture";

import { consumeLastCapturedError } from "./app/error-capture";
import { renderErrorPage } from "./app/error-page";
import { renderMaintenancePage } from "./app/maintenance-page";
import { getSupabaseBrowserClient } from "./lib/supabase/browser";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Baseline, low-risk security headers applied to every response (SSR pages and the error
// fallback alike). Deliberately does NOT set a Content-Security-Policy here — a wrong CSP fails
// silently (blocked scripts/styles, no visible error) and needs per-page verification against a
// real running build before it's safe to turn on; see docs/DEPLOYMENT_CHECKLIST.md.
function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Stage BW (supplemental queue): health checks. No liveness/readiness endpoint existed anywhere —
// a real, standard gap for a production deployment (Cloudflare's own health checks, an external
// uptime monitor, a deploy-verification step all need a plain GET a monitoring tool can hit without
// going through TanStack Start's RPC-style server-function protocol). Handled directly in this
// file — the actual Worker `fetch` entry point already customized for error handling and security
// headers — rather than a TanStack Start file-route, since this Start version doesn't expose a
// file-based server-route API (`grep`-confirmed against the installed package), and a raw fetch
// intercept here is the standard, reliable way to answer a health check without depending on SSR
// rendering succeeding at all. A real DB probe (not just "the worker process responded") since a
// worker that's up but can't reach Supabase is not actually healthy from a user's perspective;
// against `legal_document_versions`, a small, always-populated, publicly-readable table (Stage BK)
// — a `head: true` count costs nothing beyond a single index lookup, no row data transferred.
async function handleHealthCheck(): Promise<Response> {
  let databaseReachable = false;
  try {
    const { error } = await getSupabaseBrowserClient()
      .from("legal_document_versions")
      .select("id", { count: "exact", head: true });
    databaseReachable = !error;
  } catch {
    databaseReachable = false;
  }
  const maintenance = await getMaintenanceState();

  const body = {
    status: databaseReachable ? "ok" : "degraded",
    database: databaseReachable ? "reachable" : "unreachable",
    maintenance: maintenance.enabled,
  };
  return new Response(JSON.stringify(body), {
    status: databaseReachable ? 200 : 503,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Stage BZ (supplemental queue): maintenance mode. No mechanism existed to take the app down for a
// planned migration/deploy without a code change and redeploy. `app_maintenance_mode`
// (20260101011000_maintenance_mode.sql) is a real, admin-toggleable, single-row table; checked
// here in the same raw-request-intercept layer as the health check above, before any SSR rendering
// happens, so a broken app state can never block the maintenance page itself from rendering.
// Cached briefly per Worker isolate (matching this file's existing lazy-singleton pattern for
// `serverEntryPromise`) so normal traffic doesn't add a DB round-trip to every single request —
// worst case a stale read for a few seconds, which only matters at the exact moment maintenance
// mode is toggled, not during steady-state operation either way.
const MAINTENANCE_CACHE_TTL_MS = 15_000;
let maintenanceCache: { enabled: boolean; message: string; checkedAt: number } | undefined;

async function getMaintenanceState(): Promise<{ enabled: boolean; message: string }> {
  const now = Date.now();
  if (maintenanceCache && now - maintenanceCache.checkedAt < MAINTENANCE_CACHE_TTL_MS) {
    return maintenanceCache;
  }
  // Fails open: if the maintenance-mode check itself can't reach the database, don't let that
  // become an outage on top of whatever's already wrong — the real DB-down case is already
  // surfaced honestly through /health's own separate probe.
  let state = { enabled: false, message: "" };
  try {
    const { data } = await getSupabaseBrowserClient()
      .from("app_maintenance_mode")
      .select("enabled, message")
      .eq("id", true)
      .single();
    if (data) state = { enabled: data.enabled, message: data.message };
  } catch {
    state = { enabled: false, message: "" };
  }
  maintenanceCache = { ...state, checkedAt: now };
  return state;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return handleHealthCheck();
    }

    const maintenance = await getMaintenanceState();
    if (maintenance.enabled) {
      return new Response(renderMaintenancePage(maintenance.message), {
        status: 503,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "retry-after": "60",
        },
      });
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
