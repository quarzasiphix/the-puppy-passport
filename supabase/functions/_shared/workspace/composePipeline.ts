// Chains a route's steps → handler → audit into one callable.
//
//   parse (index.ts) → [steps...] → handler → (2xx) withAuditLog → response
//                                    │
//                                    └── throw → route.onError(ctx, error)
//
// Reserved slots for later, deliberately not implemented yet:
//   - rate limiting (enforce_rate_limit is a no-op for anon; needs an authed
//     limiter or the gateway's Cloudflare rule — see RATE_LIMITING_AND_ABUSE_PROTECTION.md)
//   - idempotency keys

import type { ComposedRoute, WorkspaceContext } from "./types.ts";
import { writeAuditLog } from "./audit.ts";

export function composePipeline(route: ComposedRoute) {
  return async (ctx: WorkspaceContext): Promise<Response> => {
    try {
      for (const step of route.steps) {
        const shortCircuit = await step(ctx);
        if (shortCircuit) return shortCircuit;
      }

      const response = await route.handler(ctx);

      // Proper events: every successful mutating verb records an audit_logs row.
      // Best-effort — a failed audit write is logged loudly, never fails the op.
      if (route.audit && response.status >= 200 && response.status < 300) {
        try {
          const spec = route.audit(ctx, response);
          if (spec) await writeAuditLog(ctx, spec);
        } catch (auditErr) {
          console.error(`[${ctx.action}] AUDIT WRITE FAILED (op still succeeded):`, auditErr);
        }
      }

      return response;
    } catch (error) {
      return route.onError(ctx, error);
    }
  };
}
