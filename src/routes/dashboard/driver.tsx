import { Outlet, createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/domains/identity";
import { DashboardShell } from "@/app/layouts/dashboard-shell";
import { driverNav } from "@/app/config/navigation";

export const Route = createFileRoute("/dashboard/driver")({
  beforeLoad: ({ context }) => requireRole(context.auth, ["driver", "admin"]),
  component: DriverDashboardLayout,
});

function DriverDashboardLayout() {
  return (
    <DashboardShell navItems={driverNav}>
      <Outlet />
    </DashboardShell>
  );
}
