// Domain-event / audit trail for anemalo-workspace.
//
// Every mutating verb writes one `public.audit_logs` row
// (id, actor_profile_id, action, target_type, target_id, before, after, created_at).
// `profiles.id` == `auth.users.id` (handle_new_user), so actor_profile_id = ctx.userId.
//
// Written with the SERVICE-ROLE client — audit rows are system-written, not user-writable, the
// same posture as the DB triggers that also insert here. Callers must NOT let a failed audit
// write roll back a completed side effect (an R2 object is already stored); composePipeline
// swallows+logs the error.

import type { AuditSpec, WorkspaceContext } from "./types.ts";

export async function writeAuditLog(ctx: WorkspaceContext, spec: AuditSpec): Promise<void> {
  const { error } = await ctx.service.from("audit_logs").insert({
    actor_profile_id: ctx.userId ?? null,
    action: spec.action,
    target_type: spec.targetType,
    target_id: spec.targetId ?? null,
    before: spec.before ?? null,
    after: spec.after ?? null,
  });
  if (error) throw error;
}
