import { Outlet, Link, createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Truck,
  FileText,
  CalendarCheck,
  Heart,
  Inbox,
  MessageSquare,
  PawPrint,
  User,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { requireRole } from "@/lib/auth/guards";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard-shell";
import { NotificationBell } from "@/components/notification-bell";

export const Route = createFileRoute("/dashboard/buyer")({
  beforeLoad: ({ context }) => requireRole(context.auth, []),
  component: BuyerDashboardLayout,
});

const items: DashboardNavItem[] = [
  { to: "/dashboard/buyer", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/buyer/transport", label: "Transport requests", icon: Truck },
  { to: "/dashboard/buyer/quotations", label: "Quotations", icon: Receipt },
  { to: "/dashboard/buyer/scheduled", label: "Scheduled transports", icon: CalendarCheck },
  { to: "/dashboard/buyer/documents", label: "Documents", icon: FileText },
  { to: "/dashboard/buyer/saved", label: "Saved dogs", icon: Heart },
  { to: "/dashboard/buyer/applications", label: "Puppy applications", icon: Inbox },
  { to: "/dashboard/buyer/messages", label: "Messages", icon: MessageSquare },
  { to: "/dashboard/buyer/followed", label: "Followed profiles", icon: PawPrint },
  { to: "/dashboard/buyer/profile", label: "Account", icon: User },
];

function BuyerDashboardLayout() {
  const { firstName, lastName } = useAuth();
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "your account";
  const initials =
    [firstName, lastName]
      .filter(Boolean)
      .map((n) => n![0])
      .join("")
      .toUpperCase() || "?";

  return (
    <DashboardShell
      navItems={items}
      statusLine={
        <>
          <div className="mt-2 text-xs text-muted-foreground">Signed in</div>
          <div className="text-sm font-semibold">{displayName}</div>
        </>
      }
      header={
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-background/85 px-6 py-3 backdrop-blur">
          <Button asChild variant="outline" size="sm">
            <Link to="/find-a-dog">Continue searching</Link>
          </Button>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 py-1 pl-1 pr-3">
              <div className="grid size-7 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                {initials}
              </div>
              <span className="text-sm">{firstName ?? "Account"}</span>
            </div>
          </div>
        </header>
      }
    >
      <Outlet />
    </DashboardShell>
  );
}
