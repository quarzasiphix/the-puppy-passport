import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PawPrint, Truck, HeartHandshake, Inbox } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyFoundation, listFoundationAnimals } from "@/lib/queries/foundation";
import { listTransportRequestsForKennel } from "@/lib/queries/transport";
import { listApplicationsForOrg } from "@/lib/queries/applications";
import { Card, ListSkeleton, StatusPill } from "./dashboard.breeder.index";

export const Route = createFileRoute("/dashboard/foundation/")({
  component: FoundationOverview,
});

function FoundationOverview() {
  const { userId } = useAuth();
  const orgQuery = useQuery({
    queryKey: ["my-foundation", userId],
    enabled: !!userId,
    queryFn: () => getMyFoundation(userId!),
  });
  const org = orgQuery.data;
  const animalsQuery = useQuery({
    queryKey: ["foundation-animals", org?.id],
    enabled: !!org?.id,
    queryFn: () => listFoundationAnimals(org!.id),
  });
  const transportRequestsQuery = useQuery({
    queryKey: ["foundation-transport-requests", org?.id],
    enabled: !!org?.id,
    queryFn: () => listTransportRequestsForKennel(org!.id),
  });
  const applicationsQuery = useQuery({
    queryKey: ["foundation-applications", org?.id],
    enabled: !!org?.id,
    queryFn: () => listApplicationsForOrg(org!.id),
  });
  const { data: animals } = animalsQuery;
  const { data: transportRequests } = transportRequestsQuery;
  const { data: applications } = applicationsQuery;

  const isLoading =
    orgQuery.isPending ||
    (!!org?.id &&
      (animalsQuery.isLoading || transportRequestsQuery.isLoading || applicationsQuery.isLoading));

  const availableAnimals = (animals ?? []).filter(
    (a) => a.availability_status !== "adopted" && a.availability_status !== "withdrawn",
  ).length;
  const pendingApplications = (applications ?? []).filter((a) =>
    ["submitted", "under_review", "more_info_requested", "call_requested"].includes(a.status),
  ).length;

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">
          {org?.name ? `Welcome back, ${org.name}` : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here's what's happening with your animals today.
        </p>
      </header>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Kpi icon={PawPrint} label="Available for adoption" value={availableAnimals} />
          <Kpi icon={HeartHandshake} label="Total animal records" value={animals?.length ?? 0} />
          <Link to="/dashboard/foundation/applications">
            <Kpi icon={Inbox} label="Applications awaiting reply" value={pendingApplications} />
          </Link>
          <Kpi icon={Truck} label="Transport requests" value={transportRequests?.length ?? 0} />
        </div>
      )}

      <div className="mt-6">
        <Card title="Recent animals">
          {isLoading ? (
            <ListSkeleton />
          ) : !animals?.length ? (
            <p className="text-sm text-muted-foreground">
              No animals yet. Start from the Animals page.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {animals.slice(0, 6).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.breeds?.name ?? "Mixed breed"}
                    </div>
                  </div>
                  <StatusPill status={a.availability_status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <Skeleton className="size-10 rounded-xl" />
      <Skeleton className="mt-4 h-8 w-12" />
      <Skeleton className="mt-2 h-4 w-24" />
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div className="mt-4 font-display text-3xl font-semibold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
