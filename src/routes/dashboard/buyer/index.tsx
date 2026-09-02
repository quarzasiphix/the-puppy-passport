import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Heart, MessageSquare, Truck } from "lucide-react";
import { useAuth } from "@/domains/identity";
import {
  isClosed,
  isOnHold,
  listMyTransportRequests,
  milestoneIndexForStatus,
  nextActionForStatus,
  transportMilestones,
} from "@/domains/transport";
import { ActionLauncher } from "@/app/components/action-launcher";
import {
  applicationStatusLabels,
  applicationStatusStyles,
  listMyApplications,
} from "@/domains/marketplace";
import { listSavedPuppies } from "@/domains/marketplace";

export const Route = createFileRoute("/dashboard/buyer/")({
  component: BuyerOverview,
});

function BuyerOverview() {
  const { userId, firstName } = useAuth();
  const transportQuery = useQuery({
    queryKey: ["my-transport-requests", userId],
    enabled: !!userId,
    queryFn: () => listMyTransportRequests(userId!),
  });
  const applicationsQuery = useQuery({
    queryKey: ["my-applications", userId],
    enabled: !!userId,
    queryFn: () => listMyApplications(userId!),
  });
  const savedQuery = useQuery({
    queryKey: ["my-saved-puppies", userId],
    enabled: !!userId,
    queryFn: () => listSavedPuppies(userId!),
  });
  const mostRecentTransport = transportQuery.data?.[0];

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">
          Welcome back{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">Here's where your journey stands today.</p>
      </header>

      {mostRecentTransport && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-primary/20 text-primary">
              Transport {mostRecentTransport.request_number}
            </Badge>
            <p className="text-sm">{nextActionForStatus(mostRecentTransport.status)}</p>
            <Button asChild size="sm" className="ml-auto">
              <Link to="/dashboard/buyer/transport">View transport requests</Link>
            </Button>
          </div>
        </div>
      )}

      <ActionLauncher variant="dashboard" />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card title="Transport requests" icon={<Truck className="size-5" />}>
          <div className="font-display text-3xl font-semibold">
            {transportQuery.data?.length ?? "—"}
          </div>
          <div className="text-sm text-muted-foreground">
            {mostRecentTransport
              ? `Latest: ${statusLabelFor(mostRecentTransport.status)}`
              : "None yet"}
          </div>
        </Card>
        <Card title="Applications" icon={<MessageSquare className="size-5" />}>
          <div className="font-display text-3xl font-semibold">
            {applicationsQuery.data?.length ?? "—"}
          </div>
          <div className="text-sm text-muted-foreground">Puppy applications you've sent</div>
        </Card>
        <Card title="Saved puppies" icon={<Heart className="size-5" />}>
          <div className="font-display text-3xl font-semibold">
            {savedQuery.data?.length ?? "—"}
          </div>
          <div className="text-sm text-muted-foreground">Puppies you're keeping an eye on</div>
        </Card>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Your transport requests</h2>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/buyer/transport">View all</Link>
          </Button>
        </div>
        {transportQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {transportQuery.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
            No transport requests yet.{" "}
            <Link to="/transport/request" className="text-primary hover:underline">
              Request transport
            </Link>
          </div>
        )}
        <ul className="space-y-2">
          {transportQuery.data?.slice(0, 3).map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4"
            >
              <div>
                <div className="font-medium">{t.request_number}</div>
                <div className="text-xs text-muted-foreground">
                  {t.pickup_city ?? t.pickup_country} →{" "}
                  {t.destination_city ?? t.destination_country}
                </div>
              </div>
              <Badge variant={isOnHold(t.status) ? "destructive" : "secondary"}>
                {statusLabelFor(t.status)}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Your applications</h2>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/buyer/applications">View all</Link>
          </Button>
        </div>
        {applicationsQuery.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
            No applications yet.{" "}
            <Link to="/find-a-dog" className="text-primary hover:underline">
              Find a puppy
            </Link>
          </div>
        )}
        <ul className="space-y-2">
          {applicationsQuery.data?.slice(0, 3).map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4"
            >
              <div>
                <div className="font-medium">
                  {a.animals?.name ?? "This listing"} —{" "}
                  {a.animals?.organisations?.name ?? "Independent listing"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Applied {new Date(a.submitted_at).toLocaleDateString("en-GB")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={applicationStatusStyles[a.status]}>
                  {applicationStatusLabels[a.status]}
                </Badge>
                <Button asChild size="sm" variant="outline">
                  <Link to="/puppies/$id" params={{ id: a.animal_id }}>
                    Open puppy
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Saved puppies</h2>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/buyer/saved">View all</Link>
          </Button>
        </div>
        {savedQuery.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
            No saved puppies yet — tap the heart on any listing to save it here.
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {savedQuery.data?.slice(0, 3).map((p) => (
            <Link
              key={p.id}
              to="/puppies/$id"
              params={{ id: p.id }}
              className="group overflow-hidden rounded-2xl border border-border/70 bg-card transition-colors hover:bg-secondary/40"
            >
              <img src={p.image} alt="" className="aspect-[4/3] w-full object-cover" />
              <div className="p-4">
                <div className="font-display text-lg font-semibold">{p.name}</div>
                <div className="text-sm text-muted-foreground">
                  {p.breed} · {p.kennel}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function statusLabelFor(status: string) {
  if (isClosed(status)) return "Closed";
  if (isOnHold(status)) return "On hold — action needed";
  const milestone = milestoneIndexForStatus(status);
  return transportMilestones[milestone ?? 0] ?? status.replace(/_/g, " ");
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex items-center gap-2 text-primary">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10">{icon}</span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
