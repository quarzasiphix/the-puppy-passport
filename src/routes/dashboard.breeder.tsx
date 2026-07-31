import { Outlet, Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  User,
  Dog,
  Baby,
  PawPrint as PuppyIcon,
  Inbox,
  CalendarCheck,
  Truck,
  Award,
  Crown,
  FileText,
  MessageSquare,
  Settings,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { requireRole } from "@/lib/auth/guards";
import { getMyKennelProfile } from "@/lib/queries/breeder";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard-shell";
import { NotificationBell } from "@/components/notification-bell";

export const Route = createFileRoute("/dashboard/breeder")({
  beforeLoad: ({ context }) => requireRole(context.auth, ["breeder"]),
  component: BreederDashboardLayout,
});

const items: DashboardNavItem[] = [
  { to: "/dashboard/breeder", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/breeder/profile", label: "Public profile", icon: User },
  { to: "/dashboard/breeder/parent-dogs", label: "Parent dogs", icon: Dog },
  { to: "/dashboard/breeder/litters", label: "Litters", icon: Baby },
  { to: "/dashboard/breeder/puppies", label: "Puppies", icon: PuppyIcon },
  { to: "/dashboard/breeder/applications", label: "Buyer applications", icon: Inbox },
  { to: "/dashboard/breeder/reservations", label: "Reservations", icon: CalendarCheck },
  { to: "/dashboard/breeder/transport", label: "Transport", icon: Truck },
  { to: "/dashboard/breeder/achievements", label: "Achievements", icon: Award },
  { to: "/dashboard/breeder/champions", label: "Champion dogs", icon: Crown },
  { to: "/dashboard/breeder/documents", label: "Documents", icon: FileText },
  { to: "/dashboard/breeder/messages", label: "Messages", icon: MessageSquare },
  { to: "/dashboard/breeder/settings", label: "Settings", icon: Settings },
];

function BreederDashboardLayout() {
  const { userId, firstName } = useAuth();
  const initials = firstName ? firstName[0].toUpperCase() : "?";

  const kennelQuery = useQuery({
    queryKey: ["my-kennel", userId],
    enabled: !!userId,
    queryFn: () => getMyKennelProfile(userId!),
  });

  return (
    <DashboardShell
      navItems={items}
      statusLine={
        <>
          <div className="mt-2 text-xs text-muted-foreground">Kennel</div>
          {kennelQuery.isLoading ? (
            <Skeleton className="mt-1 h-5 w-24" />
          ) : (
            <>
              <div className="text-sm font-semibold">
                {kennelQuery.data?.name ?? "Not published yet"}
              </div>
              {kennelQuery.data && (
                <Badge variant="secondary" className="mt-1 capitalize">
                  {kennelQuery.data.verification_status}
                </Badge>
              )}
            </>
          )}
        </>
      }
      header={
        <header className="sticky top-0 z-30 flex items-center justify-end gap-3 border-b border-border/60 bg-background/85 px-6 py-3 backdrop-blur">
          <NotificationBell />
          <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 py-1 pl-1 pr-3">
            <div className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </div>
            <span className="text-sm">{firstName ?? "Account"}</span>
          </div>
        </header>
      }
    >
      <Outlet />
    </DashboardShell>
  );
}
