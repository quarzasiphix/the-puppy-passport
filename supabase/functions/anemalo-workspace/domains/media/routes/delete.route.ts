// media.delete — json { orgId, ref } → { ok: true }
//
// `ref` must sit inside the caller's own `org/<orgId>/` prefix, so a member of org A can't
// delete org B's objects by passing an arbitrary key. Emits an audit_logs row.

import { composePipeline } from "../../../../_shared/workspace/composePipeline.ts";
import { err, jsonResponse } from "../../../../_shared/workspace/cors.ts";
import { requireAuth, requireOrgMember } from "../../../../_shared/workspace/steps.ts";
import type { ComposedRoute } from "../../../../_shared/workspace/types.ts";
import { getR2Config, r2DeleteObject } from "../../../../_shared/r2.ts";

const route: ComposedRoute = {
  steps: [requireAuth, requireOrgMember],
  handler: async (ctx) => {
    const r2 = getR2Config();
    if (!r2) return err(ctx.req, 503, "Media storage is not configured (R2 secrets missing).");

    const ref = String(ctx.body.ref ?? "");
    const prefix = `org/${ctx.orgId}/`;
    if (!ref.startsWith(prefix) || ref.includes("..")) {
      return err(ctx.req, 400, "`ref` must be an object path inside this organisation");
    }

    await r2DeleteObject(r2, ref);
    (ctx as unknown as { _deleted: string })._deleted = ref;
    return jsonResponse(ctx.req, 200, { ok: true });
  },
  audit: (ctx) => {
    const ref = (ctx as unknown as { _deleted?: string })._deleted;
    if (!ref) return null;
    return {
      action: "media.delete",
      targetType: "organisation",
      targetId: ctx.orgId,
      before: { ref },
    };
  },
  onError: (ctx, error) => {
    console.error("[media.delete] error:", error);
    return err(ctx.req, 502, "Delete failed");
  },
};

export const handleDelete = composePipeline(route);
