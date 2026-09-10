import { err } from "../_shared/workspace/cors.ts";
import type { WorkspaceContext } from "../_shared/workspace/types.ts";
import { dispatchMedia } from "./domains/media/media.router.ts";

/** domain → sub-router. Unknown domain → 400. */
export function dispatch(ctx: WorkspaceContext): Promise<Response> {
  switch (ctx.domain) {
    case "media":
      return dispatchMedia(ctx);
    default:
      return Promise.resolve(
        err(ctx.req, 400, `Unknown action: ${ctx.domain}.${ctx.verb}`, "unknown_action"),
      );
  }
}
