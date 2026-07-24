import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Check, MapPin, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  advanceJobStatus,
  driverStatusSteps,
  getMyActiveRoute,
  getMyDriverRecord,
  listMyJobsForRoute,
  listRouteStops,
} from "@/lib/queries/driver";
import { ReportIncidentDialog } from "@/components/report-incident-dialog";

export const Route = createFileRoute("/dashboard/driver/")({
  component: DriverHome,
});

const stepLabels: Record<string, string> = {
  driver_assigned: "Assigned",
  pickup_confirmed: "Pickup confirmed",
  animal_collected: "Animal collected",
  in_transport: "In transport",
  approaching_destination: "Approaching destination",
  delivered: "Delivered",
  handover_confirmed: "Handover confirmed",
};

function DriverHome() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const driverQuery = useQuery({
    queryKey: ["my-driver-record", userId],
    enabled: !!userId,
    queryFn: () => getMyDriverRecord(userId!),
  });
  const routeQuery = useQuery({
    queryKey: ["my-active-route", driverQuery.data?.id],
    enabled: !!driverQuery.data?.id,
    queryFn: () => getMyActiveRoute(driverQuery.data!.id),
  });
  const stopsQuery = useQuery({
    queryKey: ["my-route-stops", routeQuery.data?.id],
    enabled: !!routeQuery.data?.id,
    queryFn: () => listRouteStops(routeQuery.data!.id),
  });
  const jobsQuery = useQuery({
    queryKey: ["my-route-jobs", driverQuery.data?.id, routeQuery.data?.id],
    enabled: !!driverQuery.data?.id && !!routeQuery.data?.id,
    queryFn: () => listMyJobsForRoute(driverQuery.data!.id, routeQuery.data!.id),
  });

  const advanceMutation = useMutation({
    mutationFn: (input: { transportRequestId: string; newStatus: string }) =>
      advanceJobStatus(input),
    onSuccess: () => {
      toast.success("Updated.");
      queryClient.invalidateQueries({ queryKey: ["my-route-jobs"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update."),
  });

  if (driverQuery.isLoading || routeQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!driverQuery.data) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Your account isn't linked to a driver record yet — contact operations.
        </p>
      </div>
    );
  }

  if (!routeQuery.data) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
        <Truck className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">No active route right now</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          You'll see your next assigned route here as soon as operations schedules one for you.
        </p>
      </div>
    );
  }

  const route = routeQuery.data;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/70 bg-card p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {route.route_number}
        </p>
        <h1 className="mt-1 font-display text-2xl font-medium">{route.route_name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{route.origin_country ?? "?"}</span>
          <ArrowRight className="size-3.5" />
          <span>{route.destination_countries.join(", ") || "?"}</span>
          {route.departure_date && (
            <Badge variant="secondary">
              Departs {new Date(route.departure_date).toLocaleDateString("en-GB")}
            </Badge>
          )}
        </div>
      </div>

      {!!stopsQuery.data?.length && (
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Stops</h2>
          <ol className="space-y-2">
            {stopsQuery.data.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-medium capitalize">{s.stop_type}</span>
                <span className="text-muted-foreground">
                  {s.city ?? "?"}, {s.country ?? "?"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div>
        <h2 className="mb-3 font-display text-lg font-semibold">
          Animals on this route ({jobsQuery.data?.length ?? 0})
        </h2>
        {!jobsQuery.data?.length ? (
          <p className="text-sm text-muted-foreground">No jobs linked to this route yet.</p>
        ) : (
          <div className="space-y-4">
            {jobsQuery.data.map((job) => {
              const currentIndex = driverStatusSteps.indexOf(
                job.status as (typeof driverStatusSteps)[number],
              );
              const nextStep =
                currentIndex >= 0 && currentIndex < driverStatusSteps.length - 1
                  ? driverStatusSteps[currentIndex + 1]
                  : null;
              return (
                <div key={job.id} className="rounded-2xl border border-border/70 bg-card p-5">
                  <div className="flex items-center justify-between">
                    <div className="font-display text-lg font-semibold">
                      {job.animal_name ?? "Animal"}
                    </div>
                    <span className="text-xs text-muted-foreground">{job.request_number}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    {job.pickup_city ?? job.pickup_country ?? "?"}
                    <ArrowRight className="size-3.5" />
                    {job.destination_city ?? job.destination_country ?? "?"}
                  </div>
                  <div className="mt-3 grid gap-2 rounded-lg bg-secondary/40 p-3 text-xs sm:grid-cols-2">
                    <div>
                      <div className="font-medium uppercase tracking-wide text-muted-foreground">
                        Pickup address
                      </div>
                      <div>{job.pickup_address_exact || "Not yet provided"}</div>
                      {job.release_authorized_by && (
                        <div className="text-muted-foreground">
                          Contact: {job.release_authorized_by}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-medium uppercase tracking-wide text-muted-foreground">
                        Delivery address
                      </div>
                      <div>{job.destination_address_exact || "Not yet provided"}</div>
                      {job.receive_authorized_by && (
                        <div className="text-muted-foreground">
                          Contact: {job.receive_authorized_by}
                        </div>
                      )}
                    </div>
                  </div>
                  {job.crate_requirements && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Crate: {job.crate_requirements}
                    </p>
                  )}
                  {job.behavioural_notes && (
                    <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-warning/10 p-2 text-xs">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                      {job.behavioural_notes}
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <Badge variant="secondary">
                      {stepLabels[job.status] ?? job.status.replace(/_/g, " ")}
                    </Badge>
                    <div className="flex gap-2">
                      <ReportIncidentDialog transportRequestId={job.id} reportedBy={userId!} />
                      {nextStep && (
                        <Button
                          size="sm"
                          disabled={advanceMutation.isPending}
                          onClick={() =>
                            advanceMutation.mutate({
                              transportRequestId: job.id,
                              newStatus: nextStep,
                            })
                          }
                        >
                          <Check className="mr-1 size-4" /> Mark {stepLabels[nextStep]}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
