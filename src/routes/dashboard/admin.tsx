import { Outlet, createFileRoute } from "@tanstack/react-router";
import { requireRole, useAuth } from "@/domains/identity";
import { DashboardShell } from "@/app/layouts/dashboard-shell";
import { adminNavFor } from "@/app/config/navigation";

// One shared dashboard for both roles rather than a parallel /dashboard/moderator tree — a
// moderator and an admin see the same shell, the nav just shows fewer items for a moderator
// (adminNavFor filters on the real role). The handful of genuinely sensitive pages (users,
// fundraising, audit-logs, settings) each carry their own additional `requireRole(["admin"])` —
// nav-hiding alone would only stop a moderator from *seeing a link*, not from typing the URL.
// Product decision 2026-09-12: start with one dashboard, split into a truly separate admin app
// later only if/when that's actually needed — see docs/BREEDER_VERIFICATION_AND_TRUST.md and
// TODO.md. The is_moderator()-gated RLS/RPC layer underneath is unaffected either way.
export const Route = createFileRoute("/dashboard/admin")({
  beforeLoad: ({ context }) => requireRole(context.auth, ["moderator", "admin"]),
  component: AdminDashboardLayout,
});

function AdminDashboardLayout() {
  const { roles } = useAuth();
  const isAdmin = roles.some((r) => r.role === "admin" && r.status === "active");
  return (
    <DashboardShell navItems={adminNavFor(isAdmin)}>
      <Outlet />
    </DashboardShell>
  );
}
