import { Outlet, Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/domains/identity";
import { requireRole } from "@/domains/identity";
import { DashboardShell } from "@/app/layouts/dashboard-shell";
import { buyerNav, buyerBottomNav } from "@/app/config/navigation";

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
      settingsTo="/dashboard/buyer/profile"
      bottomNavItems={buyerBottomNav}
      headerExtra={
        <Button asChild variant="outline" size="sm">
          <Link to="/find-a-dog">Continue searching</Link>
        </Button>
      }
    >
      <Outlet />
    </DashboardShell>
  );
}
