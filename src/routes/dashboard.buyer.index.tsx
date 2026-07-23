import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageSquare, Truck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  isClosed,
  isOnHold,
  listMyTransportRequests,
  milestoneIndexForStatus,
  nextActionForStatus,
  transportMilestones,
} from "@/lib/queries/transport";
import { ActionLauncher } from "@/components/action-launcher";
import {
  applicationStatusLabels,
  applicationStatusStyles,
  listMyApplications,
} from "@/lib/queries/applications";
import { listSavedAnimals } from "@/lib/queries/buyer-activity";
import { useTranslation } from "@/lib/i18n";
import { formatDate } from "@/lib/presentation/date";
import { ErrorState } from "@/components/public/error-state";
import { AnimalImage } from "@/components/marketplace/animal-image";

export const Route = createFileRoute("/dashboard/buyer/")({
  component: BuyerOverview,
});

function BuyerOverview() {
  const { userId, firstName } = useAuth();
  const { locale } = useTranslation();
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
    queryKey: ["my-saved-animals", userId],
    enabled: !!userId,
    queryFn: () => listSavedAnimals(userId!),
  });
  const savedPreview = savedQuery.data?.slice(0, 3);
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
          <div className="text-sm text-muted-foreground">
            Puppy applications and adoption enquiries you've sent
          </div>
        </Card>
        <Card title="Saved" icon={<Heart className="size-5" />}>
          <div className="font-display text-3xl font-semibold">
            {savedQuery.data?.length ?? "—"}
          </div>
          <div className="text-sm text-muted-foreground">
            Puppies and dogs you're keeping an eye on
          </div>
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
        {transportQuery.isError && <SectionError onRetry={() => transportQuery.refetch()} />}
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
        {applicationsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {applicationsQuery.isError && <SectionError onRetry={() => applicationsQuery.refetch()} />}
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
                  Applied {formatDate(a.submitted_at, locale)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={applicationStatusStyles[a.status]}>
                  {applicationStatusLabels[a.status]}
                </Badge>
                <Button asChild size="sm" variant="outline">
                  {a.application_type === "purchase" ? (
                    <Link to="/puppies/$id" params={{ id: a.animal_id }}>
                      Open puppy
                    </Link>
                  ) : (
                    <Link to="/adoptions/$id" params={{ id: a.animal_id }}>
                      Open listing
                    </Link>
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Saved</h2>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/buyer/saved">View all</Link>
          </Button>
        </div>
        {savedQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {savedQuery.isError && <SectionError onRetry={() => savedQuery.refetch()} />}
        {savedQuery.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
            Nothing saved yet — tap the heart on any listing to save it here.
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {savedPreview?.map((s) => {
            const item = s.kind === "puppy" ? s.puppy : s.adoption;
            const secondary = s.kind === "puppy" ? s.puppy.kennel : s.adoption.orgName;
            return (
              <Link
                key={item.id}
                to={s.kind === "puppy" ? "/puppies/$id" : "/adoptions/$id"}
                params={{ id: item.id }}
                className="group overflow-hidden rounded-2xl border border-border/70 bg-card transition-colors hover:bg-secondary/40"
              >
                <AnimalImage src={item.image} alt="" className="aspect-[4/3] w-full object-cover" />
                <div className="p-4">
                  <div className="font-display text-lg font-semibold">{item.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {item.breed} · {secondary}
                  </div>
                </div>
              </Link>
            );
          })}
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

function SectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <ErrorState
      compact
      title="Couldn't load this — try again"
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      }
    />
  );
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
