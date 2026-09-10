// media domain — writes to the public `anemalo-media` R2 bucket. Reads never come here
// (media.anemalo.com serves the bucket directly). See docs/BREEDER_SITE_SDK.md Part A.

import { err } from "../../../_shared/workspace/cors.ts";
import type { WorkspaceContext } from "../../../_shared/workspace/types.ts";
import { handleUpload } from "./routes/upload.route.ts";
import { handleDelete } from "./routes/delete.route.ts";

export function dispatchMedia(ctx: WorkspaceContext): Promise<Response> {
  switch (ctx.verb) {
    case "upload":
      return handleUpload(ctx);
    case "delete":
      return handleDelete(ctx);
    default:
      return Promise.resolve(err(ctx.req, 400, `Unknown action: media.${ctx.verb}`, "unknown_action"));
  }
}
