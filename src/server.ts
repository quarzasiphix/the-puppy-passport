import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
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

  const body = {
    status: databaseReachable ? "ok" : "degraded",
    database: databaseReachable ? "reachable" : "unreachable",
  };
  return new Response(JSON.stringify(body), {
    status: databaseReachable ? 200 : 503,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return handleHealthCheck();
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
