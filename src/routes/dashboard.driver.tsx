import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Truck } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard-shell";

export const Route = createFileRoute("/dashboard/driver")({
  beforeLoad: ({ context }) => requireRole(context.auth, ["driver", "admin"]),
  component: DriverDashboardLayout,
});

// Deliberately a single nav item — this workspace is meant to be opened on a phone right before or
// during a job, not browsed like the ops dashboard.
const items: DashboardNavItem[] = [
  { to: "/dashboard/driver", label: "My route", icon: Truck, exact: true },
];

function DriverDashboardLayout() {
  return (
    <DashboardShell navItems={items}>
      <Outlet />
    </DashboardShell>
  );
}
