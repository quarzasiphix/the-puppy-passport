// media.upload — multipart { orgId, kind, file } → { ok, ref, url, bytes, contentType }
//
// The object key is DERIVED from the verified orgId, so a member of org A can never place an
// object in org B's prefix. Type allowlist + 15 MB cap. Emits an audit_logs row.

import { composePipeline } from "../../../../_shared/workspace/composePipeline.ts";
import { err, jsonResponse } from "../../../../_shared/workspace/cors.ts";
import { requireAuth, requireOrgMember } from "../../../../_shared/workspace/steps.ts";
import type { ComposedRoute } from "../../../../_shared/workspace/types.ts";
import { getR2Config, publicUrl, r2PutObject } from "../../../../_shared/r2.ts";

const KINDS = new Set(["dog", "puppy", "gallery", "logo", "cover", "post"]);
const EXT_BY_TYPE: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/avif": "avif",
  "image/gif": "gif",
};
const MAX_BYTES = 15 * 1024 * 1024;

const route: ComposedRoute = {
  steps: [requireAuth, requireOrgMember],
  handler: async (ctx) => {
    const r2 = getR2Config();
    if (!r2) return err(ctx.req, 503, "Media storage is not configured (R2 secrets missing).");

    const kind = String(ctx.body.kind ?? "");
    if (!KINDS.has(kind)) {
      return err(ctx.req, 400, `\`kind\` must be one of ${[...KINDS].join(", ")}`);
    }
    const file = ctx.file;
    if (!file) return err(ctx.req, 400, "`file` is required");
    if (file.size === 0) return err(ctx.req, 400, "`file` is empty");
    if (file.size > MAX_BYTES) return err(ctx.req, 413, `File too large (max ${MAX_BYTES / 1048576} MB)`);

    const type = file.type || "application/octet-stream";
    const ext = EXT_BY_TYPE[type];
    if (!ext) {
      return err(
        ctx.req,
        415,
        `Unsupported type "${type}" (allowed: ${Object.keys(EXT_BY_TYPE).join(", ")})`,
      );
    }

    const ref = `org/${ctx.orgId}/${kind}/${crypto.randomUUID()}.${ext}`;
    await r2PutObject(r2, ref, await file.arrayBuffer(), type);

    // Stash for the audit hook (handler already validated everything).
    (ctx as unknown as { _uploaded: unknown })._uploaded = { ref, kind, bytes: file.size, type };
    return jsonResponse(ctx.req, 200, {
      ok: true,
      ref,
      url: publicUrl(r2, ref),
      bytes: file.size,
      contentType: type,
    });
  },
  audit: (ctx) => {
    const u = (ctx as unknown as { _uploaded?: { ref: string; kind: string; bytes: number } })
      ._uploaded;
    if (!u) return null;
    return {
      action: "media.upload",
      targetType: "organisation",
      targetId: ctx.orgId,
      after: { ref: u.ref, kind: u.kind, bytes: u.bytes },
    };
  },
  onError: (ctx, error) => {
    console.error("[media.upload] error:", error);
    return err(ctx.req, 502, "Upload failed");
  },
};

export const handleUpload = composePipeline(route);
