import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/shared/ui/badge";
import { useAuth } from "@/domains/identity";
import { requireRole } from "@/domains/identity";
import { getMyFoundationProfile } from "@/domains/breeders";
import { DashboardShell } from "@/app/layouts/dashboard-shell";
import { foundationNav } from "@/app/config/navigation";

export const Route = createFileRoute("/dashboard/foundation")({
  beforeLoad: ({ context }) => requireRole(context.auth, ["foundation_member", "shelter_member"]),
  component: FoundationDashboardLayout,
});

function FoundationDashboardLayout() {
  const { userId } = useAuth();
  const orgQuery = useQuery({
    queryKey: ["my-foundation", userId],
    enabled: !!userId,
    queryFn: () => getMyFoundationProfile(userId!),
  });

  return (
    <DashboardShell
      navItems={foundationNav}
      statusLine={
        <>
          <div className="mt-2 text-xs text-muted-foreground">Organisation</div>
          <div className="text-sm font-semibold">{orgQuery.data?.name ?? "Not published yet"}</div>
          {orgQuery.data && (
            <Badge variant="secondary" className="mt-1 capitalize">
              {orgQuery.data.verification_status}
            </Badge>
          )}
        </>
      }
    >
      <Outlet />
    </DashboardShell>
  );
}
