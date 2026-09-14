import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  TriangleAlert,
  UserPlus,
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
  addRouteStopContact,
  assignRequestToRoute,
  checkRouteCompatibility,
  ContactPicker,
  getRoute,
  listDrivers,
  listOpsRouteStops,
  listRouteAssignments,
  listRouteStopContacts,
  listVehicles,
  moveRouteStopPickupOrder,
  moveRouteStopDropoffOrder,
  removeRouteStop,
  removeRouteStopContact,
  updateRoute,
  updateRouteStop,
  type RouteStopRow,
} from "@/domains/transport";
import type { Database } from "@/lib/supabase/types";
import { buildMapsSearchUrl, parseAddressFromMapsUrl } from "@/lib/maps";

// Pure layout at /dashboard/operations/routes/$id.tsx renders <Outlet /> — same pattern as
// dashboard/breeder/litters.tsx: this file is the route detail
// (/dashboard/operations/routes/$id), routes.$id.stop.$stopId.tsx is the new stop-detail page
// nested under it (/dashboard/operations/routes/$id/stop/$stopId).
export const Route = createFileRoute("/dashboard/operations/routes/$id/")({
  component: RouteDetail,
});

type RouteDetailsFormValues = {
  routeName: string;
  departureDate: string;
  originCountry: string;
  destinationCountries: string;
  maxCapacity: string;
};

const routeStatusOptions: Database["public"]["Enums"]["route_status"][] = [
  "planning",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];

// route_stop_type keeps its original 'pickup'/'dropoff'/'rest' values at the database layer, but
// since every animal stop now carries BOTH a pickup leg and a dropoff leg on the same row (the
// trip_stops shape), the pickup/dropoff distinction is no longer meaningful here — the only real
// choice ops makes is "an animal is being handled at this stop" (stored as 'pickup', arbitrarily)
// vs "this is just a rest/fuel stop" ('rest').
type StopKind = "animal" | "rest";

type StopFormValues = {
  kind: StopKind;
  city: string;
  country: string;
  plannedTime: string;
  animalLabel: string;
  pickupMapsUrl: string;
  pickupAddressText: string;
  pickupContactName: string;
  pickupContactPhone: string;
  pickupNotes: string;
  dropoffMapsUrl: string;
  dropoffAddressText: string;
  dropoffContactName: string;
  dropoffContactPhone: string;
  dropoffNotes: string;
};

const EMPTY_STOP_FORM: StopFormValues = {
  kind: "animal",
  city: "",
  country: "",
  plannedTime: "",
  animalLabel: "",
  pickupMapsUrl: "",
  pickupAddressText: "",
  pickupContactName: "",
  pickupContactPhone: "",
  pickupNotes: "",
  dropoffMapsUrl: "",
  dropoffAddressText: "",
  dropoffContactName: "",
  dropoffContactPhone: "",
  dropoffNotes: "",
};

function stopFormFromRow(s: RouteStopRow): StopFormValues {
  return {
    kind: s.stop_type === "rest" ? "rest" : "animal",
    city: s.city ?? "",
    country: s.country ?? "",
    plannedTime: s.planned_time ? s.planned_time.slice(0, 16) : "",
    animalLabel: s.animal_label ?? "",
    pickupMapsUrl: s.pickup_maps_url ?? "",
    pickupAddressText: s.pickup_address_text ?? "",
    pickupContactName: s.pickup_contact_name ?? "",
    pickupContactPhone: s.pickup_contact_phone ?? "",
    pickupNotes: s.pickup_notes ?? "",
    dropoffMapsUrl: s.dropoff_maps_url ?? "",
    dropoffAddressText: s.dropoff_address_text ?? "",
    dropoffContactName: s.dropoff_contact_name ?? "",
    dropoffContactPhone: s.dropoff_contact_phone ?? "",
    dropoffNotes: s.dropoff_notes ?? "",
  };
}

function RouteDetail() {
  const { id } = useParams({ from: "/dashboard/operations/routes/$id/" });
  const queryClient = useQueryClient();
  const posthog = usePostHog();
  const [pickerRequestId, setPickerRequestId] = useState<string>("");
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsForm, setDetailsForm] = useState<RouteDetailsFormValues | null>(null);
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

  const statusMutation = useMutation({
    mutationFn: (status: Database["public"]["Enums"]["route_status"]) =>
      updateRoute(id, { status }),
    onSuccess: () => {
      toast.success("Status updated.");
      invalidateRoute();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update status."),
  });

  const detailsMutation = useMutation({
    mutationFn: (values: RouteDetailsFormValues) =>
      updateRoute(id, {
        route_name: values.routeName,
        departure_date: values.departureDate || null,
        origin_country: values.originCountry || null,
        destination_countries: values.destinationCountries
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        max_capacity: Number(values.maxCapacity) || 1,
      }),
    onSuccess: () => {
      toast.success("Route details updated.");
      setDetailsDialogOpen(false);
      invalidateRoute();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update route."),
  });

  const openEditDetails = () => {
    if (!routeQuery.data) return;
    const r = routeQuery.data;
    setDetailsForm({
      routeName: r.route_name,
      departureDate: r.departure_date ?? "",
      originCountry: r.origin_country ?? "",
      destinationCountries: r.destination_countries.join(", "),
      maxCapacity: String(r.max_capacity),
    });
    setDetailsDialogOpen(true);
  };

  const stopMutation = useMutation({
    mutationFn: (values: StopFormValues) => {
      const payload = {
        stop_type: values.kind === "rest" ? ("rest" as const) : ("pickup" as const),
        city: values.city || null,
        country: values.country || null,
        planned_time: values.plannedTime ? new Date(values.plannedTime).toISOString() : null,
        animal_label: values.kind === "animal" ? values.animalLabel || null : null,
        pickup_maps_url: values.pickupMapsUrl || null,
        pickup_address_text: values.pickupAddressText || null,
        pickup_contact_name: values.pickupContactName || null,
        pickup_contact_phone: values.pickupContactPhone || null,
        pickup_notes: values.pickupNotes || null,
        dropoff_maps_url: values.dropoffMapsUrl || null,
        dropoff_address_text: values.dropoffAddressText || null,
        dropoff_contact_name: values.dropoffContactName || null,
        dropoff_contact_phone: values.dropoffContactPhone || null,
        dropoff_notes: values.dropoffNotes || null,
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

  // Extra contacts (beyond the primary pickup/dropoff pair) only make sense once a stop already
  // exists, so this query/mutation pair is scoped to whichever stop is currently being edited.
  const stopContactsQuery = useQuery({
    queryKey: ["route-stop-contacts", editingStop?.id],
    enabled: !!editingStop,
    queryFn: () => listRouteStopContacts(editingStop!.id),
  });
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactRole, setNewContactRole] = useState("");

  const invalidateStopContacts = () =>
    queryClient.invalidateQueries({ queryKey: ["route-stop-contacts", editingStop?.id] });

  const addContactMutation = useMutation({
    mutationFn: () =>
      addRouteStopContact(editingStop!.id, {
        contact_name: newContactName,
        contact_phone: newContactPhone || null,
        role_label: newContactRole || null,
      }),
    onSuccess: () => {
      setNewContactName("");
      setNewContactPhone("");
      setNewContactRole("");
      invalidateStopContacts();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add contact."),
  });

  const removeContactMutation = useMutation({
    mutationFn: (contactId: string) => removeRouteStopContact(contactId),
    onSuccess: invalidateStopContacts,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not remove contact."),
  });

  const removeStopMutation = useMutation({
    mutationFn: (stopId: string) => removeRouteStop(stopId),
    onSuccess: () => {
      toast.success("Stop removed.");
      invalidateStops();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not remove stop."),
  });

  const movePickupMutation = useMutation({
    mutationFn: (input: { stops: RouteStopRow[]; stopId: string; direction: "up" | "down" }) =>
      moveRouteStopPickupOrder(input.stops, input.stopId, input.direction),
    onSuccess: invalidateStops,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not reorder stops."),
  });
  const moveDropoffMutation = useMutation({
    mutationFn: (input: { stops: RouteStopRow[]; stopId: string; direction: "up" | "down" }) =>
      moveRouteStopDropoffOrder(input.stops, input.stopId, input.direction),
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

  // Two independent planning sequences instead of one combined stop_order — pickup_order and
  // dropoff_order can now interleave however the real circuit runs. Rest/fuel stops only carry a
  // pickup leg conceptually, so they're sequenced in the pickup list only.
  const allStops = stopsQuery.data ?? [];
  const pickupOrderedStops = allStops.slice().sort((a, b) => a.pickup_order - b.pickup_order);
  const dropoffOrderedStops = allStops
    .filter((s) => s.stop_type !== "rest")
    .slice()
    .sort((a, b) => a.dropoff_order - b.dropoff_order);

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
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-medium">{route.route_name}</h1>
            <Button size="sm" variant="ghost" onClick={openEditDetails}>
              <Pencil className="size-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {route.route_number} · {route.origin_country ?? "?"} →{" "}
            {route.destination_countries.join(", ") || "?"}
            {route.departure_date &&
              ` · Departs ${new Date(route.departure_date).toLocaleDateString("en-GB")}`}
          </p>
        </div>
        <Select
          value={route.status}
          onValueChange={(v) =>
            statusMutation.mutate(v as Database["public"]["Enums"]["route_status"])
          }
        >
          <SelectTrigger className="w-40 capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {routeStatusOptions.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit route</DialogTitle>
          </DialogHeader>
          {detailsForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                detailsMutation.mutate(detailsForm);
              }}
              className="space-y-3"
            >
              <div>
                <Label className="text-xs">Route name</Label>
                <Input
                  value={detailsForm.routeName}
                  onChange={(e) =>
                    setDetailsForm((f) => (f ? { ...f, routeName: e.target.value } : f))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Departure date</Label>
                  <Input
                    type="date"
                    value={detailsForm.departureDate}
                    onChange={(e) =>
                      setDetailsForm((f) => (f ? { ...f, departureDate: e.target.value } : f))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Max capacity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={detailsForm.maxCapacity}
                    onChange={(e) =>
                      setDetailsForm((f) => (f ? { ...f, maxCapacity: e.target.value } : f))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Origin country</Label>
                  <Input
                    value={detailsForm.originCountry}
                    onChange={(e) =>
                      setDetailsForm((f) => (f ? { ...f, originCountry: e.target.value } : f))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Destination countries (comma separated)</Label>
                  <Input
                    value={detailsForm.destinationCountries}
                    onChange={(e) =>
                      setDetailsForm((f) =>
                        f ? { ...f, destinationCountries: e.target.value } : f,
                      )
                    }
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={detailsMutation.isPending}>
                Save changes
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

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
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingStop ? "Edit stop" : "Add stop"}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  stopMutation.mutate(stopForm);
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Kind</Label>
                    <Select
                      value={stopForm.kind}
                      onValueChange={(v) => setStopForm((f) => ({ ...f, kind: v as StopKind }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="animal">Animal pickup/dropoff</SelectItem>
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

                {stopForm.kind === "animal" && (
                  <>
                    <div>
                      <Label className="text-xs">Animal</Label>
                      <Input
                        placeholder="e.g. Rex (Labrador)"
                        value={stopForm.animalLabel}
                        onChange={(e) =>
                          setStopForm((f) => ({ ...f, animalLabel: e.target.value }))
                        }
                        required
                      />
                    </div>

                    {allStops.filter((s) => s.id !== editingStop?.id).length > 0 && (
                      <div>
                        <Label className="text-xs">Copy pickup from… (optional)</Label>
                        <Select
                          onValueChange={(stopId) => {
                            const source = allStops.find((s) => s.id === stopId);
                            if (!source) return;
                            setStopForm((f) => ({
                              ...f,
                              pickupMapsUrl: source.pickup_maps_url ?? "",
                              pickupAddressText: source.pickup_address_text ?? "",
                              pickupContactName: source.pickup_contact_name ?? "",
                              pickupContactPhone: source.pickup_contact_phone ?? "",
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Same address as another animal?" />
                          </SelectTrigger>
                          <SelectContent>
                            {allStops
                              .filter((s) => s.id !== editingStop?.id)
                              .map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.animal_label || `${s.city ?? "?"}, ${s.country ?? "?"}`}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-3 rounded-xl border border-border/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Pickup
                      </p>
                      <Input
                        placeholder="https://maps.google.com/…"
                        value={stopForm.pickupMapsUrl}
                        onChange={(e) =>
                          setStopForm((f) => ({ ...f, pickupMapsUrl: e.target.value }))
                        }
                        onBlur={(e) => {
                          if (!stopForm.pickupAddressText.trim()) {
                            const parsed = parseAddressFromMapsUrl(e.target.value);
                            if (parsed) setStopForm((f) => ({ ...f, pickupAddressText: parsed }));
                          }
                        }}
                      />
                      <Input
                        placeholder="Address"
                        value={stopForm.pickupAddressText}
                        onChange={(e) =>
                          setStopForm((f) => ({ ...f, pickupAddressText: e.target.value }))
                        }
                        onBlur={(e) => {
                          const address = e.target.value.trim();
                          if (address && !stopForm.pickupMapsUrl.trim()) {
                            setStopForm((f) => ({
                              ...f,
                              pickupMapsUrl: buildMapsSearchUrl(address),
                            }));
                          }
                        }}
                      />
                      <ContactPicker
                        organizationId={null}
                        name={stopForm.pickupContactName}
                        phone={stopForm.pickupContactPhone}
                        onChange={({ name, phone }) =>
                          setStopForm((f) => ({
                            ...f,
                            pickupContactName: name,
                            pickupContactPhone: phone,
                          }))
                        }
                      />
                      <Textarea
                        rows={2}
                        placeholder="Notes"
                        value={stopForm.pickupNotes}
                        onChange={(e) =>
                          setStopForm((f) => ({ ...f, pickupNotes: e.target.value }))
                        }
                      />
                    </div>

                    <div className="space-y-3 rounded-xl border border-border/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Dropoff
                      </p>
                      <Input
                        placeholder="https://maps.google.com/…"
                        value={stopForm.dropoffMapsUrl}
                        onChange={(e) =>
                          setStopForm((f) => ({ ...f, dropoffMapsUrl: e.target.value }))
                        }
                        onBlur={(e) => {
                          if (!stopForm.dropoffAddressText.trim()) {
                            const parsed = parseAddressFromMapsUrl(e.target.value);
                            if (parsed) setStopForm((f) => ({ ...f, dropoffAddressText: parsed }));
                          }
                        }}
                      />
                      <Input
                        placeholder="Address"
                        value={stopForm.dropoffAddressText}
                        onChange={(e) =>
                          setStopForm((f) => ({ ...f, dropoffAddressText: e.target.value }))
                        }
                        onBlur={(e) => {
                          const address = e.target.value.trim();
                          if (address && !stopForm.dropoffMapsUrl.trim()) {
                            setStopForm((f) => ({
                              ...f,
                              dropoffMapsUrl: buildMapsSearchUrl(address),
                            }));
                          }
                        }}
                      />
                      <ContactPicker
                        organizationId={null}
                        name={stopForm.dropoffContactName}
                        phone={stopForm.dropoffContactPhone}
                        onChange={({ name, phone }) =>
                          setStopForm((f) => ({
                            ...f,
                            dropoffContactName: name,
                            dropoffContactPhone: phone,
                          }))
                        }
                      />
                      <Textarea
                        rows={2}
                        placeholder="Notes"
                        value={stopForm.dropoffNotes}
                        onChange={(e) =>
                          setStopForm((f) => ({ ...f, dropoffNotes: e.target.value }))
                        }
                      />
                    </div>
                  </>
                )}

                <Button type="submit" className="w-full" disabled={stopMutation.isPending}>
                  {editingStop ? "Save changes" : "Add stop"}
                </Button>
              </form>

              {editingStop && stopForm.kind === "animal" && (
                <div className="space-y-3 rounded-xl border border-border/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Extra contacts
                  </p>
                  {!stopContactsQuery.data?.length ? (
                    <p className="text-xs text-muted-foreground">
                      No extra contacts yet — the pickup/dropoff contacts above cover most cases.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {stopContactsQuery.data.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-start justify-between gap-2 rounded-lg bg-secondary/40 p-2"
                        >
                          <div className="text-sm">
                            <div className="font-medium">
                              {c.contact_name}
                              {c.role_label && (
                                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                  ({c.role_label})
                                </span>
                              )}
                            </div>
                            {c.contact_phone && (
                              <a
                                href={`tel:${c.contact_phone}`}
                                className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                              >
                                <Phone className="size-3" /> {c.contact_phone}
                              </a>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            disabled={removeContactMutation.isPending}
                            onClick={() => removeContactMutation.mutate(c.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="Role"
                      value={newContactRole}
                      onChange={(e) => setNewContactRole(e.target.value)}
                    />
                    <Input
                      placeholder="Name"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                    />
                    <Input
                      placeholder="Phone"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={!newContactName.trim() || addContactMutation.isPending}
                    onClick={() => addContactMutation.mutate()}
                  >
                    <UserPlus className="mr-1 size-4" /> Add contact
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {!stopsQuery.data?.length ? (
          <p className="text-sm text-muted-foreground">No stops planned yet.</p>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Pickup order</h3>
              <div className="space-y-3">
                {pickupOrderedStops.map((s, i) => (
                  <RouteStopCard
                    key={s.id}
                    routeId={id}
                    stop={s}
                    isFirst={i === 0}
                    isLast={i === pickupOrderedStops.length - 1}
                    onMoveUp={() =>
                      movePickupMutation.mutate({
                        stops: pickupOrderedStops,
                        stopId: s.id,
                        direction: "up",
                      })
                    }
                    onMoveDown={() =>
                      movePickupMutation.mutate({
                        stops: pickupOrderedStops,
                        stopId: s.id,
                        direction: "down",
                      })
                    }
                    onEdit={() => openEditStop(s)}
                    onRemove={() => removeStopMutation.mutate(s.id)}
                    moving={movePickupMutation.isPending}
                    removing={removeStopMutation.isPending}
                  />
                ))}
              </div>
            </div>

            {dropoffOrderedStops.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Drop-off order</h3>
                <div className="space-y-3">
                  {dropoffOrderedStops.map((s, i) => (
                    <RouteStopCard
                      key={s.id}
                      routeId={id}
                      stop={s}
                      isFirst={i === 0}
                      isLast={i === dropoffOrderedStops.length - 1}
                      onMoveUp={() =>
                        moveDropoffMutation.mutate({
                          stops: dropoffOrderedStops,
                          stopId: s.id,
                          direction: "up",
                        })
                      }
                      onMoveDown={() =>
                        moveDropoffMutation.mutate({
                          stops: dropoffOrderedStops,
                          stopId: s.id,
                          direction: "down",
                        })
                      }
                      onEdit={() => openEditStop(s)}
                      onRemove={() => removeStopMutation.mutate(s.id)}
                      moving={moveDropoffMutation.isPending}
                      removing={removeStopMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
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

// A leg's "Open in Maps" is derived from mapsUrl when saved, or built on the fly from addressText
// otherwise (buildMapsSearchUrl) — a stop saved before the address<->Maps auto-fill existed can
// have an address with no maps_url yet, and this is exactly the button that should still work for
// it rather than silently showing nothing.
function StopLegSummary({
  title,
  mapsUrl,
  addressText,
  contactName,
  contactPhone,
}: {
  title: string;
  mapsUrl: string | null;
  addressText: string | null;
  contactName: string | null;
  contactPhone: string | null;
}) {
  const resolvedMapsUrl = mapsUrl || (addressText ? buildMapsSearchUrl(addressText) : null);
  if (!addressText && !contactPhone && !contactName) return null;
  return (
    <div className="flex-1 rounded-lg bg-secondary/40 p-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {addressText && <p className="mt-1 text-xs">{addressText}</p>}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {resolvedMapsUrl && (
          <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
            <a href={resolvedMapsUrl} target="_blank" rel="noreferrer">
              <MapPin className="mr-1 size-3" /> Maps
            </a>
          </Button>
        )}
        {contactPhone && (
          <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
            <a href={`tel:${contactPhone}`}>
              <Phone className="mr-1 size-3" /> {contactName || contactPhone}
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

function RouteStopCard({
  routeId,
  stop,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onEdit,
  onRemove,
  moving,
  removing,
}: {
  routeId: string;
  stop: RouteStopRow;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onRemove: () => void;
  moving: boolean;
  removing: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Badge variant="secondary" className="capitalize">
            {stop.stop_type === "rest" ? "Rest" : "Animal"}
          </Badge>
          {stop.animal_label || `${stop.city ?? "?"}, ${stop.country ?? "?"}`}
          {stop.planned_time && (
            <span className="text-xs font-normal text-muted-foreground">
              {new Date(stop.planned_time).toLocaleString("en-GB")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {stop.stop_type !== "rest" && (
            <Link
              to="/dashboard/operations/routes/$id/stop/$stopId"
              params={{ id: routeId, stopId: stop.id }}
            >
              <Button size="sm" variant="ghost">
                <Eye className="size-4" />
              </Button>
            </Link>
          )}
          <Button size="sm" variant="ghost" disabled={isFirst || moving} onClick={onMoveUp}>
            <ChevronUp className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" disabled={isLast || moving} onClick={onMoveDown}>
            <ChevronDown className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={removing}
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {stop.stop_type !== "rest" && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <StopLegSummary
            title="Pickup"
            mapsUrl={stop.pickup_maps_url}
            addressText={stop.pickup_address_text}
            contactName={stop.pickup_contact_name}
            contactPhone={stop.pickup_contact_phone}
          />
          <StopLegSummary
            title="Drop-off"
            mapsUrl={stop.dropoff_maps_url}
            addressText={stop.dropoff_address_text}
            contactName={stop.dropoff_contact_name}
            contactPhone={stop.dropoff_contact_phone}
          />
        </div>
      )}
    </div>
  );
}
