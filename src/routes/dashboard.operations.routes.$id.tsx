import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listOpsTransportRequests } from "@/lib/queries/operations";
import {
  assignRequestToRoute,
  checkRouteCompatibility,
  getRoute,
  listRouteAssignments,
} from "@/lib/queries/routes";

export const Route = createFileRoute("/dashboard/operations/routes/$id")({
  component: RouteDetail,
});

function RouteDetail() {
  const { id } = useParams({ from: "/dashboard/operations/routes/$id" });
  const queryClient = useQueryClient();
  const [pickerRequestId, setPickerRequestId] = useState<string>("");

  const routeQuery = useQuery({ queryKey: ["route", id], queryFn: () => getRoute(id) });
  const assignmentsQuery = useQuery({
    queryKey: ["route-assignments", id],
    queryFn: () => listRouteAssignments(id),
  });
  const unassignedQuery = useQuery({
    queryKey: ["ops-requests", ["ready_for_scheduling", "accepted_by_customer"]],
    queryFn: () => listOpsTransportRequests(),
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      assignRequestToRoute({
        routeId: id,
        transportRequestId: pickerRequestId,
      }),
    onSuccess: () => {
      toast.success("Request assigned to route.");
      setPickerRequestId("");
      queryClient.invalidateQueries({ queryKey: ["route-assignments", id] });
      queryClient.invalidateQueries({ queryKey: ["ops-requests"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not assign request."),
  });

  if (routeQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!routeQuery.data) return <p className="text-sm text-destructive">Route not found.</p>;
  const route = routeQuery.data;
  const assignments = assignmentsQuery.data ?? [];
  const assignedIds = new Set(assignments.map((a) => a.transport_request_id));
  const candidates = (unassignedQuery.data ?? []).filter(
    (r) =>
      !assignedIds.has(r.id) &&
      !r.assigned_route_id &&
      ["ready_for_scheduling", "accepted_by_customer", "quotation_sent"].includes(r.status),
  );
  const selectedCandidate = candidates.find((c) => c.id === pickerRequestId);
  const warnings = selectedCandidate ? checkRouteCompatibility(route, selectedCandidate) : [];

  return (
    <div>
      <Link
        to="/dashboard/operations/routes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> All routes
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium">{route.route_name}</h1>
          <p className="text-sm text-muted-foreground">
            {route.route_number} · {route.origin_country ?? "?"} →{" "}
            {route.destination_countries.join(", ") || "?"}
            {route.departure_date &&
              ` · Departs ${new Date(route.departure_date).toLocaleDateString("en-GB")}`}
          </p>
        </div>
        <Badge variant="secondary" className="capitalize">
          {route.status}
        </Badge>
      </header>

      <div className="mb-6 rounded-xl border border-border/70 bg-card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Capacity</span>
          <span>
            {assignments.length} / {route.max_capacity} assigned
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary"
            style={{ width: `${Math.min(100, (assignments.length / route.max_capacity) * 100)}%` }}
          />
        </div>
      </div>

      <section className="mb-6 rounded-2xl border border-border/70 bg-card p-5">
        <h3 className="mb-3 font-display text-base font-semibold">Assign a request</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={pickerRequestId} onValueChange={setPickerRequestId}>
            <SelectTrigger className="h-9 w-[320px]">
              <SelectValue placeholder="Select a request ready for scheduling" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.request_number} — {c.pickup_city ?? c.pickup_country} →{" "}
                  {c.destination_city ?? c.destination_country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!pickerRequestId || assignMutation.isPending}
            onClick={() => assignMutation.mutate()}
          >
            Assign
          </Button>
        </div>
        {warnings.length > 0 && (
          <div className="mt-3 space-y-1">
            {warnings.map((w) => (
              <div key={w} className="flex items-center gap-1.5 text-xs text-warning">
                <TriangleAlert className="size-3.5" /> {w}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Warnings inform your decision — they don't block assignment.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border/70 bg-card p-5">
        <h3 className="mb-3 font-display text-base font-semibold">Assigned requests</h3>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests assigned yet.</p>
        ) : (
          <ul className="space-y-2">
            {assignments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-border/70 p-3 text-sm"
              >
                <Link
                  to="/dashboard/operations/requests/$id"
                  params={{ id: a.transport_request_id }}
                  className="text-primary hover:underline"
                >
                  {a.transport_request_id}
                </Link>
                <Badge variant="secondary" className="capitalize">
                  {a.reservation_status.replace(/_/g, " ")}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
