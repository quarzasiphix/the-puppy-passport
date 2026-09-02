import { redirect } from "@tanstack/react-router";
import type { CurrentUser } from "./session";

// Used in each dashboard layout's beforeLoad. context.auth comes from the server-verified
// getCurrentUser() call in __root.tsx — never a value the frontend could fabricate. This is a UX
// guard (avoid a flash of the wrong dashboard / a confusing redirect deep in a page); the real
// enforcement is RLS on every table those pages query.
export function requireRole(
  auth: CurrentUser | null,
  allowedRoles: string[],
  redirectTo = "/dashboard/buyer",
) {
  if (!auth) {
    throw redirect({ to: "/signin" });
  }
  if (allowedRoles.length === 0) return; // any signed-in user
  const hasRole = auth.roles.some((r) => allowedRoles.includes(r.role) && r.status === "active");
  if (!hasRole) {
    throw redirect({ to: redirectTo });
  }
}
