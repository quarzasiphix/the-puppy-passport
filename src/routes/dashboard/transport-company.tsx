import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/shared/ui/badge";
import { useAuth, requireRole } from "@/domains/identity";
import { getMyTransportCompanyProfile } from "@/domains/breeders";
import { DashboardShell } from "@/app/layouts/dashboard-shell";
import { transportCompanyNav } from "@/app/config/navigation";

export const Route = createFileRoute("/dashboard/transport-company")({
  beforeLoad: ({ context }) => requireRole(context.auth, ["transport_company_owner"]),
  component: TransportCompanyDashboardLayout,
});

function TransportCompanyDashboardLayout() {
  const { userId } = useAuth();

  const companyQuery = useQuery({
    queryKey: ["my-transport-company-profile", userId],
    enabled: !!userId,
    queryFn: () => getMyTransportCompanyProfile(userId!),
  });

  return (
    <DashboardShell
      navItems={transportCompanyNav}
      statusLine={
        <>
          <div className="mt-2 text-xs text-muted-foreground">Company</div>
          <div className="text-sm font-semibold">
            {companyQuery.data?.name ?? "Not published yet"}
          </div>
          {companyQuery.data && (
            <Badge variant="secondary" className="mt-1 capitalize">
              {companyQuery.data.verification_status}
            </Badge>
          )}
        </>
      }
      settingsTo="/dashboard/transport-company/settings"
    >
      <Outlet />
    </DashboardShell>
  );
}
