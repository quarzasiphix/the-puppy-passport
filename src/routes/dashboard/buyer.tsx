import { Outlet, Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/domains/identity";
import { requireRole } from "@/domains/identity";
import { DashboardShell } from "@/app/layouts/dashboard-shell";
import { buyerNav } from "@/app/config/navigation";
import { NotificationBell } from "@/domains/messaging";
import { UserMenu } from "@/app/components/user-menu";

export const Route = createFileRoute("/dashboard/buyer")({
  beforeLoad: ({ context }) => requireRole(context.auth, []),
  component: BuyerDashboardLayout,
});

function BuyerDashboardLayout() {
  const { firstName, lastName } = useAuth();
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "your account";

  return (
    <DashboardShell
      navItems={buyerNav}
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
            <UserMenu settingsTo="/dashboard/buyer/profile" />
          </div>
        </header>
      }
    >
      <Outlet />
    </DashboardShell>
  );
}
