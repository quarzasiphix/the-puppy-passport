import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Dog, Heart, HeartHandshake, MessageSquare, Truck } from "lucide-react";
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
  getApplicationStatusLabels,
  applicationStatusStyles,
  listMyApplications,
} from "@/domains/marketplace";
import { listSavedPuppies } from "@/domains/marketplace";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/buyer/")({
  component: BuyerOverview,
});

function BuyerOverview() {
  const { t } = useTranslation();
  const { userId, firstName, roles } = useAuth();
  const orgRole = roles.find(
    (r) =>
      ["breeder", "foundation_member", "shelter_member"].includes(r.role) && r.status === "active",
  );
  const orgDashboardPath =
    orgRole?.role === "breeder" ? "/dashboard/breeder" : "/dashboard/foundation";
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
          {t("buyerPanel.index.welcomeBack")}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">{t("buyerPanel.index.subtitle")}</p>
      </header>

      {mostRecentTransport && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-primary/20 text-primary">
              {t("buyerPanel.index.transportBadgePrefix")} {mostRecentTransport.request_number}
            </Badge>
            <p className="text-sm">{nextActionForStatus(mostRecentTransport.status)}</p>
            <Button asChild size="sm" className="ml-auto">
              <Link to="/dashboard/buyer/transport">{t("buyerPanel.index.viewTransportRequests")}</Link>
            </Button>
          </div>
        </div>
      )}

      <ActionLauncher variant="dashboard" />

      <div className="mt-6 rounded-2xl border border-accent/30 bg-accent/5 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-accent/15 text-accent">
            {orgRole ? <Dog className="size-5" /> : <HeartHandshake className="size-5" />}
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {orgRole
                ? t("buyerPanel.index.orgPromptTitleHasOrg")
                : t("buyerPanel.index.orgPromptTitleNoOrg")}
            </p>
            <p className="text-sm text-muted-foreground">
              {orgRole
                ? t("buyerPanel.index.orgPromptBodyHasOrg")
                : t("buyerPanel.index.orgPromptBodyNoOrg")}
            </p>
          </div>
          <Button asChild size="sm" className="ml-auto">
            <Link to={orgRole ? orgDashboardPath : "/create-breeder"}>
              {orgRole ? t("buyerPanel.index.goToMyDashboard") : t("buyerPanel.index.getStarted")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card title={t("buyerPanel.index.statTransportTitle")} icon={<Truck className="size-5" />}>
          <div className="font-display text-3xl font-semibold">
            {transportQuery.data?.length ?? "—"}
          </div>
          <div className="text-sm text-muted-foreground">
            {mostRecentTransport
              ? `${t("buyerPanel.index.statLatestPrefix")} ${statusLabelFor(mostRecentTransport.status, t)}`
              : t("buyerPanel.index.statNoneYet")}
          </div>
        </Card>
        <Card
          title={t("buyerPanel.index.statApplicationsTitle")}
          icon={<MessageSquare className="size-5" />}
        >
          <div className="font-display text-3xl font-semibold">
            {applicationsQuery.data?.length ?? "—"}
          </div>
          <div className="text-sm text-muted-foreground">
            {t("buyerPanel.index.statApplicationsDesc")}
          </div>
        </Card>
        <Card title={t("buyerPanel.index.statSavedTitle")} icon={<Heart className="size-5" />}>
          <div className="font-display text-3xl font-semibold">
            {savedQuery.data?.length ?? "—"}
          </div>
          <div className="text-sm text-muted-foreground">{t("buyerPanel.index.statSavedDesc")}</div>
        </Card>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">
            {t("buyerPanel.index.yourTransportRequests")}
          </h2>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/buyer/transport">{t("buyerPanel.index.viewAll")}</Link>
          </Button>
        </div>
        {transportQuery.isLoading && (
          <p className="text-sm text-muted-foreground">{t("buyerPanel.index.loading")}</p>
        )}
        {transportQuery.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
            {t("buyerPanel.index.noTransportYet")}{" "}
            <Link to="/transport/request" className="text-primary hover:underline">
              {t("buyerPanel.index.requestTransport")}
            </Link>
          </div>
        )}
        <ul className="space-y-2">
          {transportQuery.data?.slice(0, 3).map((req) => (
            <li
              key={req.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4"
            >
              <div>
                <div className="font-medium">{req.request_number}</div>
                <div className="text-xs text-muted-foreground">
                  {req.pickup_city ?? req.pickup_country} →{" "}
                  {req.destination_city ?? req.destination_country}
                </div>
              </div>
              <Badge variant={isOnHold(req.status) ? "destructive" : "secondary"}>
                {statusLabelFor(req.status, t)}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">
            {t("buyerPanel.index.yourApplications")}
          </h2>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/buyer/applications">{t("buyerPanel.index.viewAll")}</Link>
          </Button>
        </div>
        {applicationsQuery.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
            {t("buyerPanel.index.noApplicationsYet")}{" "}
            <Link to="/find-a-dog" className="text-primary hover:underline">
              {t("buyerPanel.index.findAPuppy")}
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
                  {a.animals?.name ?? t("buyerPanel.index.thisListing")} —{" "}
                  {a.animals?.organisations?.name ?? t("buyerPanel.index.independentListing")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("buyerPanel.index.appliedPrefix")}{" "}
                  {new Date(a.submitted_at).toLocaleDateString("en-GB")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={applicationStatusStyles[a.status]}>
                  {getApplicationStatusLabels(t)[a.status]}
                </Badge>
                <Button asChild size="sm" variant="outline">
                  <Link to="/puppies/$id" params={{ id: a.animal_id }}>
                    {t("buyerPanel.index.openPuppy")}
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">
            {t("buyerPanel.index.statSavedTitle")}
          </h2>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/buyer/saved">{t("buyerPanel.index.viewAll")}</Link>
          </Button>
        </div>
        {savedQuery.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
            {t("buyerPanel.index.noSavedPuppies")}
          </div>
        )}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
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

function statusLabelFor(status: string, t: (key: string) => string) {
  if (isClosed(status)) return t("buyerPanel.index.statusClosed");
  if (isOnHold(status)) return t("buyerPanel.index.statusOnHold");
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
