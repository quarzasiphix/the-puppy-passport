/**
 * anemalo-gateway — api.anemalo.com
 *
 * A thin, public, org-scoped read gateway in front of the ONE shared Anemalo Supabase project.
 * It generalises Gryfin's single `get-site-content` edge function (see
 * ../docs/API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md) so every breeder public site can be a
 * template app with zero `@supabase/supabase-js` dependency of its own.
 *
 * Trust boundary: ANON key only. RLS is the access control boundary (every table read here has an
 * `anon`-role SELECT policy scoped to published + approved + public rows). No service-role key.
 *
 * NOT DEPLOYED. See README.md and wrangler.toml.
 *
 * v1 surface:
 *   GET  /health                       liveness + Supabase reachability probe
 *   GET  /v1/site-content?org=<slug|id> aggregated anon-safe payload for one org's public site
 *   GET  /v1/resolve-domain?host=<h>    Host header -> org slug (for the breeder-site fork)
 *   POST /v1/enquiry                    lead capture — HONEST 501 until the backend table exists
 */
import type { Env } from "./lib.ts";
import { anonClient, corsHeaders, errorBody, isMissingDbObject, json } from "./lib.ts";
import { handleSiteContent } from "./site-content.ts";

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

async function handleHealth(env: Env, origin: string | null): Promise<Response> {
  let databaseReachable = false;
  try {
    const { error } = await anonClient(env)
      .from("organisation_site_configurations")
      .select("organisation_id", { count: "exact", head: true });
    databaseReachable = !error;
  } catch {
    databaseReachable = false;
  }
  return json(
    {
      status: databaseReachable ? "ok" : "degraded",
      service: "anemalo-gateway",
      database: databaseReachable ? "reachable" : "unreachable",
      time: new Date().toISOString(),
    },
    { status: databaseReachable ? 200 : 503, env, origin },
  );
}

interface ResolveDomainRow {
  slug: string;
  plan: string | null;
  status: string | null;
}

async function handleResolveDomain(env: Env, url: URL, origin: string | null): Promise<Response> {
  const host = url.searchParams.get("host")?.trim().toLowerCase();
  if (!host || !HOSTNAME_RE.test(host)) {
    return json(errorBody("invalid_host", "Query parameter `host` must be a valid hostname."), {
      status: 400,
      env,
      origin,
    });
  }

  // `organisation_domains` deliberately has NO anon SELECT policy (see migration
  // 20260903000500). The least-privilege way to expose Host -> org at the edge without a
  // service-role key is a SECURITY DEFINER RPC granted to `anon` that returns only an ACTIVE
  // domain's public slug. That RPC is proposed (not yet applied) in the plan doc, section 6 /
  // roadmap P6. Until it lands this endpoint answers an honest 501 rather than faking a lookup.
  const { data, error } = await anonClient(env)
    .rpc("resolve_org_by_hostname", { p_hostname: host })
    .maybeSingle<ResolveDomainRow>();

  if (error) {
    if (isMissingDbObject(error)) {
      return json(
        errorBody("not_implemented", "Custom-domain resolution is not wired yet.", {
          detail:
            "Needs the `resolve_org_by_hostname(text)` SECURITY DEFINER RPC (roadmap P6). " +
            "See ../docs/API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md.",
        }),
        { status: 501, env, origin },
      );
    }
    throw error;
  }

  if (!data) {
    return json(errorBody("host_not_found", `No active Anemalo domain maps to "${host}".`), {
      status: 404,
      env,
      origin,
    });
  }

  return json(
    { host, org: data.slug, plan: data.plan, status: data.status },
    { env, origin, cache: "public, max-age=300, stale-while-revalidate=3600" },
  );
}

interface EnquiryInput {
  org: string;
  name: string;
  email: string;
  message: string;
  phone?: string;
  interest?: string;
}

function parseEnquiry(body: unknown): { ok: true; value: EnquiryInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Body must be a JSON object." };
  const b = body as Record<string, unknown>;
  const str = (k: string): string | null => (typeof b[k] === "string" ? (b[k] as string).trim() : null);

  const org = str("org");
  const name = str("name");
  const email = str("email");
  const message = str("message");
  if (!org) return { ok: false, error: "`org` is required." };
  if (!name) return { ok: false, error: "`name` is required." };
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "A valid `email` is required." };
  if (!message) return { ok: false, error: "`message` is required." };

  const phone = str("phone");
  const interest = str("interest");
  return {
    ok: true,
    value: { org, name, email, message, ...(phone ? { phone } : {}), ...(interest ? { interest } : {}) },
  };
}

async function handleEnquiry(env: Env, request: Request, origin: string | null): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json(errorBody("invalid_json", "Request body is not valid JSON."), {
      status: 400,
      env,
      origin,
    });
  }

  const parsed = parseEnquiry(raw);
  if (!parsed.ok) {
    return json(errorBody("invalid_input", parsed.error), { status: 400, env, origin });
  }

  // NO FAKE SUCCESS (../CLAUDE.md rule 12). Anemalo has no per-org lead/enquiry table today —
  // `buyer_applications` requires an authenticated `buyer_id` and a large structured payload, so
  // it is not a fit for an anonymous "contact this breeder" message. The plan doc (section 2 +
  // roadmap) proposes an `organisation_enquiries` table + a `submit_org_enquiry()` SECURITY
  // DEFINER RPC with its own IP-based rate limiting. Until that ships this endpoint validates and
  // then honestly refuses.
  return json(
    errorBody("not_implemented", "Enquiry capture is not wired to a backend yet.", {
      received: { org: parsed.value.org, name: parsed.value.name, email: parsed.value.email },
      detail:
        "Needs `organisation_enquiries` + `submit_org_enquiry()` (see " +
        "../docs/API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md, section 2).",
    }),
    { status: 501, env, origin },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const { pathname } = url;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env, origin) });
    }

    try {
      if (pathname === "/health" && request.method === "GET") {
        return await handleHealth(env, origin);
      }
      if (pathname === "/v1/site-content" && request.method === "GET") {
        return await handleSiteContent(env, url, origin);
      }
      if (pathname === "/v1/resolve-domain" && request.method === "GET") {
        return await handleResolveDomain(env, url, origin);
      }
      if (pathname === "/v1/enquiry" && request.method === "POST") {
        return await handleEnquiry(env, request, origin);
      }

      if (pathname === "/" || pathname === "/v1" || pathname === "/v1/") {
        return json(
          {
            service: "anemalo-gateway",
            endpoints: [
              "GET /health",
              "GET /v1/site-content?org=<slug|id>",
              "GET /v1/resolve-domain?host=<hostname>",
              "POST /v1/enquiry",
            ],
          },
          { env, origin },
        );
      }

      return json(errorBody("not_found", `No route for ${request.method} ${pathname}.`), {
        status: 404,
        env,
        origin,
      });
    } catch (err) {
      console.error("[anemalo-gateway]", err);
      const message = err instanceof Error ? err.message : "Internal error";
      return json(errorBody("internal_error", message), { status: 500, env, origin });
    }
  },
};
