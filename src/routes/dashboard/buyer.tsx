import { Outlet, Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/domains/identity";
import { requireRole } from "@/domains/identity";
import { DashboardShell } from "@/app/layouts/dashboard-shell";
import { buyerNav } from "@/app/config/navigation";
import { NotificationBell } from "@/domains/messaging";

export const Route = createFileRoute("/dashboard/buyer")({
  beforeLoad: ({ context }) => requireRole(context.auth, []),
  component: BuyerDashboardLayout,
});

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
