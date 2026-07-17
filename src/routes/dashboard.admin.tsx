import { Outlet, createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Building2,
  Dog,
  HeartHandshake,
  PawPrint,
  Award,
  Flag,
  ShieldAlert,
  Truck,
  ScrollText,
  Settings,
} from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard-shell";

export const Route = createFileRoute("/dashboard/admin")({
  beforeLoad: ({ context }) => requireRole(context.auth, ["admin"]),
  component: AdminDashboardLayout,
});

const items: DashboardNavItem[] = [
  { to: "/dashboard/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/admin/users", label: "Users", icon: Users },
  { to: "/dashboard/admin/organisations", label: "Organisations", icon: Building2 },
  { to: "/dashboard/admin/breeder-verification", label: "Breeder verification", icon: Dog },
  {
    to: "/dashboard/admin/foundation-verification",
    label: "Foundation verification",
    icon: HeartHandshake,
  },
  { to: "/dashboard/admin/listings", label: "Listings", icon: PawPrint },
  {
    to: "/dashboard/admin/achievement-verification",
    label: "Achievement verification",
    icon: Award,
  },
  { to: "/dashboard/admin/reports", label: "Reports", icon: Flag },
  { to: "/dashboard/admin/moderation", label: "Moderation", icon: ShieldAlert },
  { to: "/dashboard/operations", label: "Transport operations", icon: Truck },
  { to: "/dashboard/admin/audit-logs", label: "Audit logs", icon: ScrollText },
  { to: "/dashboard/admin/settings", label: "Settings", icon: Settings },
];

function AdminDashboardLayout() {
  return (
    <DashboardShell navItems={items}>
      <Outlet />
    </DashboardShell>
  );
}
