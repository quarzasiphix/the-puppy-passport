import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PawPrint, Truck, HeartHandshake, Inbox, Clock } from "lucide-react";
import { useAuth } from "@/domains/identity";
import { getMyFoundation, listFoundationAnimals } from "@/domains/breeders";
import { listTransportRequestsForKennel } from "@/domains/transport";
import { listApplicationsForOrg } from "@/domains/marketplace";
import { Card, StatusPill } from "@/shared/ui/panel";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/foundation/")({
  component: FoundationOverview,
});

function FoundationOverview() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const { data: org } = useQuery({
    queryKey: ["my-foundation", userId],
    enabled: !!userId,
    queryFn: () => getMyFoundation(userId!),
  });
  const { data: animals } = useQuery({
    queryKey: ["foundation-animals", org?.id],
    enabled: !!org?.id,
    queryFn: () => listFoundationAnimals(org!.id),
  });
  const { data: transportRequests } = useQuery({
    queryKey: ["foundation-transport-requests", org?.id],
    enabled: !!org?.id,
    queryFn: () => listTransportRequestsForKennel(org!.id),
  });
  const { data: applications } = useQuery({
    queryKey: ["foundation-applications", org?.id],
    enabled: !!org?.id,
    queryFn: () => listApplicationsForOrg(org!.id),
  });

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
          {org?.name
            ? `${t("foundationPanel.overview.welcomeBackPrefix")} ${org.name}`
            : t("foundationPanel.overview.welcomeBack")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("foundationPanel.overview.subtitle")}</p>
      </header>

      {/* A rejected/suspended org's role is itself no longer active (see
          reject_user_verification()), so requireRole already keeps them out of this dashboard
          entirely -- the only reachable non-approved state here is "pending review". */}
      {org && org.verification_status === "pending" && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <Clock className="mt-0.5 size-5 shrink-0 text-accent" />
          <div>
            <p className="text-sm font-semibold">
              {t("foundationPanel.overview.unverifiedBannerTitle")}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("foundationPanel.overview.unverifiedBannerBody")}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
        <Kpi
          icon={PawPrint}
          label={t("foundationPanel.overview.kpiAvailable")}
          value={availableAnimals}
        />
        <Kpi
          icon={HeartHandshake}
          label={t("foundationPanel.overview.kpiTotalRecords")}
          value={animals?.length ?? 0}
        />
        <Link to="/dashboard/foundation/applications">
          <Kpi
            icon={Inbox}
            label={t("foundationPanel.overview.kpiApplications")}
            value={pendingApplications}
          />
        </Link>
        <Kpi
          icon={Truck}
          label={t("foundationPanel.overview.kpiTransport")}
          value={transportRequests?.length ?? 0}
        />
      </div>

      <div className="mt-6">
        <Card title={t("foundationPanel.overview.recentAnimalsTitle")}>
          {!animals?.length ? (
            <p className="text-sm text-muted-foreground">
              {t("foundationPanel.overview.noAnimalsYet")}
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {animals.slice(0, 6).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.breeds?.name ?? t("foundationPanel.overview.mixedBreed")}
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
