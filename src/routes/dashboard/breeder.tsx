import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/shared/ui/badge";
import { useAuth } from "@/domains/identity";
import { requireRole } from "@/domains/identity";
import { getMyKennelProfile } from "@/domains/breeders";
import { DashboardShell } from "@/app/layouts/dashboard-shell";
import { breederNav } from "@/app/config/navigation";
import { NotificationBell } from "@/domains/messaging";

export const Route = createFileRoute("/dashboard/breeder")({
  beforeLoad: ({ context }) => requireRole(context.auth, ["breeder"]),
  component: BreederDashboardLayout,
});

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
      navItems={breederNav}
      statusLine={
        <>
          <div className="mt-2 text-xs text-muted-foreground">Kennel</div>
          <div className="text-sm font-semibold">
            {kennelQuery.data?.name ?? "Not published yet"}
          </div>
          {kennelQuery.data && (
            <Badge variant="secondary" className="mt-1 capitalize">
              {kennelQuery.data.verification_status}
            </Badge>
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
