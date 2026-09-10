// CORS + JSON helpers for the anemalo-workspace request pipeline.
// Reflects the request Origin (+ Vary) rather than a bare "*", so credentialed
// callers work; still allow-all in practice. POST + OPTIONS only.

export function buildCorsHeaders(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": req.headers.get("Origin") ?? "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export function corsPreflight(req: Request): Response {
  return new Response("ok", { headers: buildCorsHeaders(req) });
}

/** Standard envelope: { ok: true, ...data } / { ok: false, error, code? }. */
export function jsonResponse(req: Request, status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
  });
}

export function ok(req: Request, data: Record<string, unknown> = {}): Response {
  return jsonResponse(req, 200, { ok: true, ...data });
}

export function err(req: Request, status: number, error: string, code?: string): Response {
  return jsonResponse(req, status, { ok: false, error, ...(code ? { code } : {}) });
}
