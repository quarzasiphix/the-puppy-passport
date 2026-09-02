import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, UserRound } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
  assignDriverToJob,
  listDriverWorkloads,
  listUnassignedReadyJobs,
  type DriverWorkload,
} from "@/domains/transport";
import { documentExpiryWarning } from "@/domains/transport";

function driverEligibilityWarning(d: DriverWorkload): string | null {
  if (d.internal_verification_status !== "verified") return "Not yet verified";
  const expiry = documentExpiryWarning(d.document_expiry_date);
  if (expiry === "expired") return "Documents expired";
  if (expiry === "upcoming") return "Documents expiring soon";
  return null;
}

export const Route = createFileRoute("/dashboard/operations/dispatch")({
  component: DispatchPage,
});

function workloadColor(count: number) {
  if (count === 0) return "bg-success/15 text-success";
  if (count <= 2) return "bg-accent/15 text-accent";
  return "bg-warning/20 text-foreground";
}

function DispatchPage() {
  const queryClient = useQueryClient();
  const [selectedDriver, setSelectedDriver] = useState<Record<string, string>>({});

  const workloadQuery = useQuery({ queryKey: ["driver-workloads"], queryFn: listDriverWorkloads });
  const unassignedQuery = useQuery({
    queryKey: ["unassigned-ready-jobs"],
    queryFn: listUnassignedReadyJobs,
  });

  const assignMutation = useMutation({
    mutationFn: (input: { transportRequestId: string; driverId: string }) =>
      assignDriverToJob(input),
    onSuccess: () => {
      toast.success("Driver assigned.");
      queryClient.invalidateQueries({ queryKey: ["driver-workloads"] });
      queryClient.invalidateQueries({ queryKey: ["unassigned-ready-jobs"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not assign."),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium">Dispatch</h1>
        <p className="text-sm text-muted-foreground">
          Driver workload at a glance, and jobs ready for a driver to be assigned.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-semibold">Driver workload</h2>
        {workloadQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !workloadQuery.data?.length ? (
          <p className="text-sm text-muted-foreground">No drivers on file.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workloadQuery.data.map((d) => (
              <div key={d.id} className="rounded-xl border border-border/70 bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserRound className="size-4 text-muted-foreground" />
                    <span className="font-medium">{d.name}</span>
                  </div>
                  <Badge className={workloadColor(d.activeJobCount)}>
                    {d.activeJobCount} active
                  </Badge>
                </div>
                {d.availability_status && (
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    {d.availability_status.replace(/_/g, " ")}
                  </p>
                )}
                {driverEligibilityWarning(d) && (
                  <p className="mt-1 text-xs font-medium text-destructive">
                    ⚠ {driverEligibilityWarning(d)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">
          Ready for a driver ({unassignedQuery.data?.length ?? 0})
        </h2>
        {unassignedQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !unassignedQuery.data?.length ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-6 text-center">
            <p className="text-sm text-muted-foreground">Nothing waiting on a driver right now.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {unassignedQuery.data.map((job) => (
              <div
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4"
              >
                <div>
                  <div className="font-medium">
                    {job.animal_name ?? "Animal"}{" "}
                    <span className="text-xs text-muted-foreground">{job.request_number}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {job.pickup_city ?? "?"}
                    <ArrowRight className="size-3" />
                    {job.destination_city ?? "?"}
                    {job.earliest_date && (
                      <span>
                        · Earliest {new Date(job.earliest_date).toLocaleDateString("en-GB")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedDriver[job.id] ?? ""}
                    onValueChange={(v) => setSelectedDriver({ ...selectedDriver, [job.id]: v })}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {(workloadQuery.data ?? []).map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} ({d.activeJobCount} active)
                          {driverEligibilityWarning(d) ? ` — ⚠ ${driverEligibilityWarning(d)}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!selectedDriver[job.id] || assignMutation.isPending}
                    onClick={() =>
                      assignMutation.mutate({
                        transportRequestId: job.id,
                        driverId: selectedDriver[job.id],
                      })
                    }
                  >
                    Assign
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
