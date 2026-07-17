import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Building2,
  PawPrint,
  Inbox,
  Truck,
  AlertTriangle,
  FileText,
  Users,
  MessageSquare,
  Settings,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { requireRole } from "@/lib/auth/guards";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard-shell";

export const Route = createFileRoute("/dashboard/foundation")({
  beforeLoad: ({ context }) => requireRole(context.auth, ["foundation_member", "shelter_member"]),
  component: FoundationDashboardLayout,
});

const items: DashboardNavItem[] = [
  { to: "/dashboard/foundation", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/foundation/profile", label: "Organisation profile", icon: Building2 },
  { to: "/dashboard/foundation/animals", label: "Animals", icon: PawPrint },
  { to: "/dashboard/foundation/applications", label: "Adoption applications", icon: Inbox },
  { to: "/dashboard/foundation/transport", label: "Transport requests", icon: Truck },
  { to: "/dashboard/foundation/urgent", label: "Urgent cases", icon: AlertTriangle },
  { to: "/dashboard/foundation/documents", label: "Documents", icon: FileText },
  { to: "/dashboard/foundation/team", label: "Team", icon: Users },
  { to: "/dashboard/foundation/messages", label: "Messages", icon: MessageSquare },
  { to: "/dashboard/foundation/settings", label: "Settings", icon: Settings },
];

function FoundationDashboardLayout() {
  const { userId } = useAuth();
  const orgQuery = useQuery({
    queryKey: ["my-foundation", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("organisations")
        .select("name, verification_status")
        .eq("owner_user_id", userId!)
        .in("org_type", ["foundation", "shelter", "rescue"])
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <DashboardShell
      navItems={items}
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
