import { Outlet, createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/domains/identity";
import { DashboardShell } from "@/app/layouts/dashboard-shell";
import { adminNav } from "@/app/config/navigation";

export const Route = createFileRoute("/dashboard/admin")({
  beforeLoad: ({ context }) => requireRole(context.auth, ["admin"]),
  component: AdminDashboardLayout,
});

function AdminDashboardLayout() {
  return (
    <DashboardShell navItems={adminNav}>
      <Outlet />
    </DashboardShell>
  );
}
