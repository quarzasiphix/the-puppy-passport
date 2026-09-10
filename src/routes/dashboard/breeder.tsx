import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/shared/ui/badge";
import { useAuth } from "@/domains/identity";
import { requireRole } from "@/domains/identity";
import { getMyKennelProfile, getKennelSiteConfiguration } from "@/domains/breeders";
import { DashboardShell } from "@/app/layouts/dashboard-shell";
import { breederNav } from "@/app/config/navigation";
import { NotificationBell } from "@/domains/messaging";
import { UserMenu } from "@/app/components/user-menu";

export const Route = createFileRoute("/dashboard/breeder")({
  beforeLoad: ({ context }) => requireRole(context.auth, ["breeder"]),
  component: BreederDashboardLayout,
});

function BreederDashboardLayout() {
  const { userId } = useAuth();

  const kennelQuery = useQuery({
    queryKey: ["my-kennel", userId],
    enabled: !!userId,
    queryFn: () => getMyKennelProfile(userId!),
  });
  const siteConfigQuery = useQuery({
    queryKey: ["kennel-site-config", kennelQuery.data?.id],
    enabled: !!kennelQuery.data?.id,
    queryFn: () => getKennelSiteConfiguration(kennelQuery.data!.id),
  });

  return (
    <DashboardShell
      navItems={breederNav}
      accentColor={siteConfigQuery.data?.primaryColor}
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
          <UserMenu settingsTo="/dashboard/breeder/settings" />
        </header>
      }
    >
      <Outlet />
    </DashboardShell>
  );
}
