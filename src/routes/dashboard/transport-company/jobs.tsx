import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/shared/ui/badge";
import { listMyFleetJobs, isOnHold } from "@/domains/transport";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/transport-company/jobs")({
  component: JobsPage,
});

function JobsPage() {
  const { t } = useTranslation();
  // RLS ("company members view jobs assigned to their fleet") already scopes this to requests
  // assigned to the caller's own vehicles/drivers — see 20260912150000_fleet_multi_tenancy.sql.
  // Read-only: a company never writes transport_requests.status from here.
  const query = useQuery({ queryKey: ["my-fleet-jobs"], queryFn: listMyFleetJobs });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium">
          {t("transportCompanyPanel.jobs.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("transportCompanyPanel.jobs.subtitle")}
        </p>
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("transportCompanyPanel.jobs.loading")}</p>
      ) : !query.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t("transportCompanyPanel.jobs.emptyBody")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-4">{t("transportCompanyPanel.jobs.colRequest")}</th>
                <th className="p-4">{t("transportCompanyPanel.jobs.colRoute")}</th>
                <th className="p-4">{t("transportCompanyPanel.jobs.colStatus")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {query.data.map((j) => (
                <tr key={j.id}>
                  <td className="p-4 font-medium">{j.request_number}</td>
                  <td className="p-4 text-muted-foreground">
                    {j.pickup_city ?? j.pickup_country} →{" "}
                    {j.destination_city ?? j.destination_country}
                  </td>
                  <td className="p-4">
                    <Badge variant={isOnHold(j.status) ? "destructive" : "secondary"}>
                      {j.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
