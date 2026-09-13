import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/shared/ui/badge";
import { listMyFleetJobs, isOnHold, isClosed, type FleetJobRow } from "@/domains/transport";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/transport-company/calendar")({
  component: CalendarPage,
});

// A real calendar over the same data Jobs/Dispatch already read (listMyFleetJobs, RLS-scoped to
// the caller's own fleet) — an agenda grouped by earliest_date rather than a full month grid.
// Anemalo's own internal ops calendar (dashboard/operations/calendar.tsx) is built over a
// different, heavier model (routes/route_assignments — a multi-stop plan ops staff build, with no
// per-company scoping at all today); reusing it here isn't possible without adding real
// organisation_id scoping to that table first, which is a separate, bigger schema change. This is
// the right-sized calendar for what a company can actually see and act on today.
function groupByDate(jobs: FleetJobRow[]): [string | null, FleetJobRow[]][] {
  const groups = new Map<string | null, FleetJobRow[]>();
  for (const j of jobs) {
    const key = j.earliest_date;
    groups.set(key, [...(groups.get(key) ?? []), j]);
  }
  // Null (no date set yet) sorts last, real dates ascending.
  return Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a.localeCompare(b);
  });
}

function CalendarPage() {
  const { t, locale } = useTranslation();
  const jobsQuery = useQuery({ queryKey: ["my-fleet-jobs"], queryFn: listMyFleetJobs });
  const jobs = (jobsQuery.data ?? []).filter((j) => !isClosed(j.status));
  const groups = groupByDate(jobs);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium">
          {t("transportCompanyPanel.calendar.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("transportCompanyPanel.calendar.subtitle")}
        </p>
      </header>

      {jobsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("transportCompanyPanel.calendar.loading")}
        </p>
      ) : !jobs.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t("transportCompanyPanel.calendar.emptyBody")}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([date, dateJobs]) => (
            <section key={date ?? "unset"}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {date
                  ? new Date(date).toLocaleDateString(locale === "pl" ? "pl-PL" : "en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : t("transportCompanyPanel.calendar.noDateGroup")}
              </h2>
              <div className="space-y-2">
                {dateJobs.map((j) => (
                  <Link
                    key={j.id}
                    to="/dashboard/transport-company/dispatch"
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4 transition-colors hover:bg-secondary/40"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">
                        {j.request_number}
                        {j.animal_name && (
                          <span className="ml-2 font-normal text-muted-foreground">
                            · {j.animal_name}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {j.pickup_city ?? j.pickup_country} →{" "}
                        {j.destination_city ?? j.destination_country}
                      </div>
                    </div>
                    <Badge variant={isOnHold(j.status) ? "destructive" : "secondary"}>
                      {j.status.replace(/_/g, " ")}
                    </Badge>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
