import { Outlet, createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/domains/identity";
import { DashboardShell } from "@/app/layouts/dashboard-shell";
import { operationsNav, operationsBottomNav } from "@/app/config/navigation";

export const Route = createFileRoute("/dashboard/operations")({
  beforeLoad: ({ context }) => requireRole(context.auth, ["operations", "admin"]),
  component: OperationsDashboardLayout,
});

function OperationsDashboardLayout() {
  return (
    <DashboardShell navItems={operationsNav} bottomNavItems={operationsBottomNav}>
      <Outlet />
    </DashboardShell>
  );
}
