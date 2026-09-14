import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { listOpsTransportRequests } from "@/domains/operations";
import {
  addRouteStop,
  assignRequestToRoute,
  checkRouteCompatibility,
  getRoute,
  listDrivers,
  listOpsRouteStops,
  listRouteAssignments,
  listVehicles,
  moveRouteStop,
  removeRouteStop,
  updateRoute,
  updateRouteStop,
  type RouteStopRow,
} from "@/domains/transport";
import type { Database } from "@/lib/supabase/types";

export const Route = createFileRoute("/dashboard/operations/routes/$id")({
  component: RouteDetail,
});

type StopFormValues = {
  stopType: Database["public"]["Enums"]["route_stop_type"];
  city: string;
  country: string;
  plannedTime: string;
  animalLabel: string;
  addressText: string;
  mapsUrl: string;
  contactName: string;
  contactPhone: string;
  notes: string;
};

const EMPTY_STOP_FORM: StopFormValues = {
  stopType: "pickup",
  city: "",
  country: "",
  plannedTime: "",
  animalLabel: "",
  addressText: "",
  mapsUrl: "",
  contactName: "",
  contactPhone: "",
  notes: "",
};

function stopFormFromRow(s: RouteStopRow): StopFormValues {
  return {
    stopType: s.stop_type,
    city: s.city ?? "",
    country: s.country ?? "",
    plannedTime: s.planned_time ? s.planned_time.slice(0, 16) : "",
    animalLabel: s.animal_label ?? "",
    addressText: s.address_text ?? "",
    mapsUrl: s.maps_url ?? "",
    contactName: s.contact_name ?? "",
    contactPhone: s.contact_phone ?? "",
    notes: s.notes ?? "",
  };
}

function RouteDetail() {
  const { id } = useParams({ from: "/dashboard/operations/routes/$id" });
  const queryClient = useQueryClient();
  const posthog = usePostHog();
  const [pickerRequestId, setPickerRequestId] = useState<string>("");
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<RouteStopRow | null>(null);
  const [stopForm, setStopForm] = useState<StopFormValues>(EMPTY_STOP_FORM);

  const routeQuery = useQuery({ queryKey: ["route", id], queryFn: () => getRoute(id) });
  const assignmentsQuery = useQuery({
    queryKey: ["route-assignments", id],
    queryFn: () => listRouteAssignments(id),
  });
  const unassignedQuery = useQuery({
    queryKey: ["ops-requests", ["ready_for_scheduling", "accepted_by_customer"]],
    queryFn: () => listOpsTransportRequests(),
  });
  const stopsQuery = useQuery({
    queryKey: ["route-stops", id],
    queryFn: () => listOpsRouteStops(id),
  });
  const vehiclesQuery = useQuery({ queryKey: ["vehicles"], queryFn: listVehicles });
  const driversQuery = useQuery({ queryKey: ["drivers"], queryFn: listDrivers });

  const invalidateRoute = () => queryClient.invalidateQueries({ queryKey: ["route", id] });
  const invalidateStops = () => queryClient.invalidateQueries({ queryKey: ["route-stops", id] });

  const assignMutation = useMutation({
    mutationFn: () =>
      assignRequestToRoute({
        routeId: id,
        transportRequestId: pickerRequestId,
      }),
    onSuccess: () => {
      posthog.capture("transport_request_assigned_to_route");
      toast.success("Request assigned to route.");
      setPickerRequestId("");
      queryClient.invalidateQueries({ queryKey: ["route-assignments", id] });
      queryClient.invalidateQueries({ queryKey: ["ops-requests"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not assign request."),
  });

  const fleetMutation = useMutation({
    mutationFn: (patch: { vehicle_id?: string | null; driver_id?: string | null }) =>
      updateRoute(id, patch),
    onSuccess: () => {
      toast.success("Route updated.");
      invalidateRoute();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update route."),
  });

  const stopMutation = useMutation({
    mutationFn: (values: StopFormValues) => {
      const payload = {
        stop_type: values.stopType,
        city: values.city || null,
        country: values.country || null,
        planned_time: values.plannedTime ? new Date(values.plannedTime).toISOString() : null,
        animal_label: values.animalLabel || null,
        address_text: values.addressText || null,
        maps_url: values.mapsUrl || null,
        contact_name: values.contactName || null,
        contact_phone: values.contactPhone || null,
        notes: values.notes || null,
      };
      return editingStop ? updateRouteStop(editingStop.id, payload) : addRouteStop(id, payload);
    },
    onSuccess: () => {
      toast.success(editingStop ? "Stop updated." : "Stop added.");
      setStopDialogOpen(false);
      setEditingStop(null);
      setStopForm(EMPTY_STOP_FORM);
      invalidateStops();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save this stop."),
  });

  const removeStopMutation = useMutation({
    mutationFn: (stopId: string) => removeRouteStop(stopId),
    onSuccess: () => {
      toast.success("Stop removed.");
      invalidateStops();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not remove stop."),
  });

  const moveStopMutation = useMutation({
    mutationFn: (input: { stopId: string; direction: "up" | "down" }) =>
      moveRouteStop(stopsQuery.data ?? [], input.stopId, input.direction),
    onSuccess: invalidateStops,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not reorder stops."),
  });

  const openAddStop = () => {
    setEditingStop(null);
    setStopForm(EMPTY_STOP_FORM);
    setStopDialogOpen(true);
  };

  const openEditStop = (stop: RouteStopRow) => {
    setEditingStop(stop);
    setStopForm(stopFormFromRow(stop));
    setStopDialogOpen(true);
  };

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
        <h3 className="mb-3 font-display text-base font-semibold">Vehicle & driver</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Vehicle</Label>
            <Select
              value={route.vehicle_id ?? "none"}
              onValueChange={(v) => fleetMutation.mutate({ vehicle_id: v === "none" ? null : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {vehiclesQuery.data?.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Driver</Label>
            <Select
              value={route.driver_id ?? "none"}
              onValueChange={(v) => fleetMutation.mutate({ driver_id: v === "none" ? null : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {driversQuery.data?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-border/70 bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold">Stops</h3>
          <Dialog
            open={stopDialogOpen}
            onOpenChange={(open) => {
              setStopDialogOpen(open);
              if (!open) {
                setEditingStop(null);
                setStopForm(EMPTY_STOP_FORM);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" onClick={openAddStop}>
                <Plus className="mr-1 size-4" /> Add stop
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingStop ? "Edit stop" : "Add stop"}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  stopMutation.mutate(stopForm);
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={stopForm.stopType}
                      onValueChange={(v) =>
                        setStopForm((f) => ({
                          ...f,
                          stopType: v as Database["public"]["Enums"]["route_stop_type"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pickup">Pickup</SelectItem>
                        <SelectItem value="dropoff">Dropoff</SelectItem>
                        <SelectItem value="rest">Rest / fuel stop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Planned time</Label>
                    <Input
                      type="datetime-local"
                      value={stopForm.plannedTime}
                      onChange={(e) => setStopForm((f) => ({ ...f, plannedTime: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">City</Label>
                    <Input
                      value={stopForm.city}
                      onChange={(e) => setStopForm((f) => ({ ...f, city: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Country</Label>
                    <Input
                      value={stopForm.country}
                      onChange={(e) => setStopForm((f) => ({ ...f, country: e.target.value }))}
                    />
                  </div>
                </div>
                {stopForm.stopType !== "rest" && (
                  <div className="space-y-3 rounded-xl border border-border/60 p-3">
                    <div>
                      <Label className="text-xs">Animal</Label>
                      <Input
                        placeholder="e.g. Rex (Labrador)"
                        value={stopForm.animalLabel}
                        onChange={(e) =>
                          setStopForm((f) => ({ ...f, animalLabel: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Address</Label>
                      <Input
                        value={stopForm.addressText}
                        onChange={(e) =>
                          setStopForm((f) => ({ ...f, addressText: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Maps link</Label>
                      <Input
                        placeholder="https://maps.google.com/…"
                        value={stopForm.mapsUrl}
                        onChange={(e) => setStopForm((f) => ({ ...f, mapsUrl: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Contact name</Label>
                        <Input
                          value={stopForm.contactName}
                          onChange={(e) =>
                            setStopForm((f) => ({ ...f, contactName: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Contact phone</Label>
                        <Input
                          value={stopForm.contactPhone}
                          onChange={(e) =>
                            setStopForm((f) => ({ ...f, contactPhone: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    rows={2}
                    value={stopForm.notes}
                    onChange={(e) => setStopForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={stopMutation.isPending}>
                  {editingStop ? "Save changes" : "Add stop"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {!stopsQuery.data?.length ? (
          <p className="text-sm text-muted-foreground">No stops planned yet.</p>
        ) : (
          <ol className="space-y-2">
            {stopsQuery.data.map((s, i) => (
              <li key={s.id} className="rounded-xl border border-border/70 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Badge variant="secondary" className="capitalize">
                          {s.stop_type}
                        </Badge>
                        {s.animal_label || `${s.city ?? "?"}, ${s.country ?? "?"}`}
                      </div>
                      {s.animal_label && (
                        <div className="text-xs text-muted-foreground">
                          {s.city ?? "?"}, {s.country ?? "?"}
                        </div>
                      )}
                      {s.planned_time && (
                        <div className="text-xs text-muted-foreground">
                          {new Date(s.planned_time).toLocaleString("en-GB")}
                        </div>
                      )}
                      {s.address_text && <div className="text-xs">{s.address_text}</div>}
                      {(s.contact_name || s.contact_phone) && (
                        <div className="text-xs text-muted-foreground">
                          {[s.contact_name, s.contact_phone].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      {s.notes && (
                        <div className="mt-1 text-xs text-muted-foreground">{s.notes}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={i === 0 || moveStopMutation.isPending}
                      onClick={() => moveStopMutation.mutate({ stopId: s.id, direction: "up" })}
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={i === stopsQuery.data.length - 1 || moveStopMutation.isPending}
                      onClick={() => moveStopMutation.mutate({ stopId: s.id, direction: "down" })}
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEditStop(s)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={removeStopMutation.isPending}
                      onClick={() => removeStopMutation.mutate(s.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

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
