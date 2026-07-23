import { Outlet, createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Inbox,
  ClipboardCheck,
  Receipt,
  Route as RouteIcon,
  Truck,
  Sparkles,
  Calendar,
  Car,
  UserRound,
  FileText,
  ShieldAlert,
  AlertOctagon,
  CheckCircle2,
  TrendingUp,
  Users,
  HeartPulse,
} from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard-shell";

export const Route = createFileRoute("/dashboard/operations")({
  beforeLoad: ({ context }) => requireRole(context.auth, ["operations", "admin"]),
  component: OperationsDashboardLayout,
});

const items: DashboardNavItem[] = [
  { to: "/dashboard/operations", label: "Operations overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/operations/new-requests", label: "New requests", icon: Inbox },
  { to: "/dashboard/operations/review-queue", label: "Review queue", icon: ClipboardCheck },
  { to: "/dashboard/operations/quotations", label: "Quotations", icon: Receipt },
  { to: "/dashboard/operations/routes", label: "Planned routes", icon: RouteIcon },
  { to: "/dashboard/operations/profitability", label: "Profitability", icon: TrendingUp },
  { to: "/dashboard/operations/active", label: "Active transports", icon: Truck },
  { to: "/dashboard/operations/matching", label: "Matching suggestions", icon: Sparkles },
  { to: "/dashboard/operations/dispatch", label: "Dispatch", icon: Users },
  { to: "/dashboard/operations/calendar", label: "Calendar", icon: Calendar },
  { to: "/dashboard/operations/vehicles", label: "Vehicles", icon: Car },
  { to: "/dashboard/operations/drivers", label: "Drivers", icon: UserRound },
  { to: "/dashboard/operations/documents", label: "Documents", icon: FileText },
  { to: "/dashboard/operations/compliance-holds", label: "Compliance holds", icon: ShieldAlert },
  { to: "/dashboard/operations/welfare-cases", label: "Welfare cases", icon: HeartPulse },
  { to: "/dashboard/operations/incidents", label: "Incidents", icon: AlertOctagon },
  { to: "/dashboard/operations/completed", label: "Completed transports", icon: CheckCircle2 },
];

function OperationsDashboardLayout() {
  return (
    <DashboardShell navItems={items}>
      <Outlet />
    </DashboardShell>
  );
}
