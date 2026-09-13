import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { getMyFleetJobDetail, isOnHold, listDrivers, listVehicles } from "@/domains/transport";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/transport-company/jobs/$id")({
  component: CompanyJobDetail,
});

function CompanyJobDetail() {
  const { t } = useTranslation();
  const { id } = useParams({ from: "/dashboard/transport-company/jobs/$id" });

  const jobQuery = useQuery({
    queryKey: ["my-fleet-job", id],
    queryFn: () => getMyFleetJobDetail(id),
  });
  // Same "resolve id to a display name" pattern as the trip detail page — no extra org filter
  // needed, listDrivers/listVehicles are already scoped to what this caller can see.
  const driversQuery = useQuery({ queryKey: ["drivers"], queryFn: listDrivers });
  const vehiclesQuery = useQuery({ queryKey: ["vehicles"], queryFn: listVehicles });

  if (jobQuery.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">{t("transportCompanyPanel.jobs.loading")}</p>
    );
  }
  const job = jobQuery.data;
  if (!job) return <p className="text-sm text-destructive">Not found.</p>;

  const driverName = driversQuery.data?.find((d) => d.id === job.assigned_driver_id)?.name;
  const vehicleName = vehiclesQuery.data?.find((v) => v.id === job.assigned_vehicle_id)?.name;

  return (
    <div>
      <Link
        to="/dashboard/transport-company/jobs"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {t("transportCompanyPanel.jobs.detailBack")}
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium">{job.request_number}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {job.pickup_city ?? job.pickup_country} →{" "}
            {job.destination_city ?? job.destination_country}
          </p>
        </div>
        <Badge variant={isOnHold(job.status) ? "destructive" : "secondary"}>
          {job.status.replace(/_/g, " ")}
        </Badge>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <div className="text-xs text-muted-foreground">
            {t("transportCompanyPanel.jobs.fieldDriver")}
          </div>
          <div className="mt-1 font-display text-lg font-semibold">
            {driverName ?? t("transportCompanyPanel.jobs.unassigned")}
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <div className="text-xs text-muted-foreground">
            {t("transportCompanyPanel.jobs.fieldVehicle")}
          </div>
          <div className="mt-1 font-display text-lg font-semibold">
            {vehicleName ?? t("transportCompanyPanel.jobs.unassigned")}
          </div>
        </div>
        {job.animal_name && (
          <div className="rounded-2xl border border-border/70 bg-card p-5 sm:col-span-2">
            <div className="text-xs text-muted-foreground">Animal</div>
            <div className="mt-1 font-display text-lg font-semibold">{job.animal_name}</div>
          </div>
        )}
        {(job.earliest_date || job.latest_date) && (
          <div className="rounded-2xl border border-border/70 bg-card p-5 sm:col-span-2">
            <div className="text-xs text-muted-foreground">Window</div>
            <div className="mt-1 text-sm">
              {job.earliest_date && new Date(job.earliest_date).toLocaleDateString("en-GB")}
              {job.latest_date && ` – ${new Date(job.latest_date).toLocaleDateString("en-GB")}`}
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Reassign your own driver or vehicle for this job from the Dispatch page.
      </p>
    </div>
  );
}
