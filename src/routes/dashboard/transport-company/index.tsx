import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Car, UserRound, Inbox, ShieldAlert } from "lucide-react";
import { useAuth } from "@/domains/identity";
import { getMyTransportCompanyProfile } from "@/domains/breeders";
import { listVehicles, listDrivers, listMyFleetJobs, isClosed } from "@/domains/transport";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/transport-company/")({
  component: TransportCompanyOverview,
});

function TransportCompanyOverview() {
  const { t } = useTranslation();
  const { userId, firstName } = useAuth();

  const companyQuery = useQuery({
    queryKey: ["my-transport-company-profile", userId],
    enabled: !!userId,
    queryFn: () => getMyTransportCompanyProfile(userId!),
  });
  // RLS already scopes both queries to this company's own rows (organization_id) for a non-ops
  // caller — no client-side org filter needed, see 20260912150000_fleet_multi_tenancy.sql.
  const vehiclesQuery = useQuery({ queryKey: ["vehicles"], queryFn: listVehicles });
  const driversQuery = useQuery({ queryKey: ["drivers"], queryFn: listDrivers });
  const jobsQuery = useQuery({ queryKey: ["my-fleet-jobs"], queryFn: listMyFleetJobs });

  const activeDrivers =
    driversQuery.data?.filter((d) => d.availability_status === "available").length ?? 0;
  const openJobs = jobsQuery.data?.filter((j) => !isClosed(j.status)).length;

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">
          {firstName
            ? `${t("transportCompanyPanel.overview.welcomeBackPrefix")} ${firstName}`
            : t("transportCompanyPanel.overview.welcomeBack")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("transportCompanyPanel.overview.subtitle")}
        </p>
      </header>

      {companyQuery.data && companyQuery.data.verification_status !== "approved" && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-5">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-accent" />
          <div>
            <p className="text-sm font-semibold">
              {t("transportCompanyPanel.overview.unverifiedBannerTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("transportCompanyPanel.overview.unverifiedBannerBody")}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card
          title={t("transportCompanyPanel.overview.kpiVehicles")}
          value={vehiclesQuery.data?.length ?? "—"}
          icon={<Car className="size-5" />}
        />
        <Card
          title={t("transportCompanyPanel.overview.kpiDrivers")}
          value={driversQuery.data?.length ?? "—"}
          icon={<UserRound className="size-5" />}
        />
        <Card
          title={t("transportCompanyPanel.overview.kpiActiveDrivers")}
          value={activeDrivers}
          icon={<UserRound className="size-5" />}
        />
        <Card
          title={t("transportCompanyPanel.overview.kpiOpenJobs")}
          value={openJobs ?? "—"}
          icon={<Inbox className="size-5" />}
        />
      </div>
    </div>
  );
}

function Card({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex items-center gap-2 text-primary">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10">{icon}</span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="mt-3 font-display text-2xl font-semibold">{value}</div>
    </div>
  );
}
