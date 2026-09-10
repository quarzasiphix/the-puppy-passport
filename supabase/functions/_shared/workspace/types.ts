// Shared types for the anemalo-workspace request pipeline. Mirrors the
// ksiegai-workspace pipeline shape (see docs/EDGE_FUNCTION_ARCHITECTURE.md).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface ParsedRequest {
  /** "<domain>.<verb>", e.g. "media.upload". */
  action: string;
  /** Parsed JSON body, or the non-file multipart fields, as a flat record. */
  body: Record<string, unknown>;
  /** The uploaded file for multipart requests, else null. */
  file: File | null;
}

/**
 * Mutable per-request context threaded through every pipeline step. A step
 * only populates a field if it is in the route's `steps` list, so a handler
 * may rely on `ctx.userId` only if `requireAuth` ran, `ctx.orgId` /
 * `ctx.membership` only if `requireOrgMember` ran, etc.
 */
export interface WorkspaceContext {
  req: Request;
  action: string;
  /** domain part of the action ("media"). */
  domain: string;
  /** verb part of the action ("upload"). */
  verb: string;
  body: Record<string, unknown>;
  file: File | null;
  /** service-role client — created once per request; use only for system writes (audit) or a deliberate elevation. */
  service: SupabaseClient;

  // set by requireAuth
  userId?: string;
  /** anon-key client carrying the caller's JWT — RLS is the access boundary for every query made with it. */
  rls?: SupabaseClient;

  // set by requireOrgMember
  orgId?: string;
  membership?: { member_role: string; status: string };
}

export type PipelineStep = (ctx: WorkspaceContext) => Promise<Response | void>;
export type RouteHandler = (ctx: WorkspaceContext) => Promise<Response>;
export type RouteErrorMapper = (ctx: WorkspaceContext, error: unknown) => Response | Promise<Response>;

/** Written to `audit_logs` after a successful handler when a route sets `audit`. */
export interface AuditSpec {
  action: string; // usually === ctx.action
  targetType: string; // "organisation", "animal", ...
  targetId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export interface ComposedRoute {
  steps: PipelineStep[];
  handler: RouteHandler;
  onError: RouteErrorMapper;
  /**
   * Optional audit event. Return null to skip (e.g. a read, or a no-op).
   * Runs best-effort AFTER a 2xx handler response — a failed audit write is
   * logged loudly but never fails the operation (see EDGE_FUNCTION_ARCHITECTURE.md).
   */
  audit?: (ctx: WorkspaceContext, response: Response) => AuditSpec | null;
}
