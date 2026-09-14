import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft,
  PackageCheck,
  PackageOpen,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
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
import {
  addStopContact,
  addTripStop,
  ContactPicker,
  getTrip,
  listDrivers,
  listStopContacts,
  listTripStops,
  listVehicles,
  markStopDelivered,
  markStopPickedUp,
  removeStopContact,
  removeTripStop,
  setTripStatus,
  updateTrip,
  updateTripStop,
  type TripStopRow,
} from "@/domains/transport";
import type { Database } from "@/lib/supabase/types";

export const Route = createFileRoute("/dashboard/operations/trips/$id")({
  component: OpsTripDetail,
});

const tripStatusOptions: Database["public"]["Enums"]["trip_status"][] = [
  "planning",
  "in_progress",
  "completed",
  "cancelled",
];

type StopFormValues = {
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

function stopFormFromRow(s: TripStopRow): StopFormValues {
  return {
    animalLabel: s.animal_label,
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

function OpsTripDetail() {
  const { id } = useParams({ from: "/dashboard/operations/trips/$id" });
  const queryClient = useQueryClient();
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<TripStopRow | null>(null);
  const [stopForm, setStopForm] = useState<StopFormValues>(EMPTY_STOP_FORM);

  const tripQuery = useQuery({ queryKey: ["ops-trip", id], queryFn: () => getTrip(id) });
  const stopsQuery = useQuery({
    queryKey: ["ops-trip-stops", id],
    queryFn: () => listTripStops(id),
  });
  const vehiclesQuery = useQuery({ queryKey: ["vehicles"], queryFn: listVehicles });
  const driversQuery = useQuery({ queryKey: ["drivers"], queryFn: listDrivers });

  const invalidateTrip = () => queryClient.invalidateQueries({ queryKey: ["ops-trip", id] });
  const invalidateStops = () => queryClient.invalidateQueries({ queryKey: ["ops-trip-stops", id] });

  const fleetMutation = useMutation({
    mutationFn: (patch: { vehicle_id?: string | null; driver_id?: string | null }) =>
      updateTrip(id, patch),
    onSuccess: () => {
      toast.success("Trip updated.");
      invalidateTrip();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update trip."),
  });

  const statusMutation = useMutation({
    mutationFn: (status: Database["public"]["Enums"]["trip_status"]) => setTripStatus(id, status),
    onSuccess: () => {
      toast.success("Status updated.");
      invalidateTrip();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update status."),
  });

  const notesMutation = useMutation({
    mutationFn: (notes: string) => updateTrip(id, { notes: notes || null }),
    onSuccess: invalidateTrip,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save notes."),
  });

  const stopMutation = useMutation({
    mutationFn: async (values: StopFormValues) => {
      const payload = {
        animal_label: values.animalLabel,
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
      if (editingStop) {
        await updateTripStop(editingStop.id, payload);
      } else {
        await addTripStop(id, payload);
      }
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
    mutationFn: (stopId: string) => removeTripStop(stopId),
    onSuccess: () => {
      toast.success("Stop removed.");
      invalidateStops();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not remove stop."),
  });

  // Extra contacts only make sense once a stop already exists — scoped to whichever stop is
  // currently open in the dialog, same pattern as the company's own trips.$tripId.tsx.
  const stopContactsQuery = useQuery({
    queryKey: ["ops-trip-stop-contacts", editingStop?.id],
    enabled: !!editingStop,
    queryFn: () => listStopContacts(editingStop!.id),
  });
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactRole, setNewContactRole] = useState("");

  const invalidateStopContacts = () =>
    queryClient.invalidateQueries({ queryKey: ["ops-trip-stop-contacts", editingStop?.id] });

  const addContactMutation = useMutation({
    mutationFn: () =>
      addStopContact(editingStop!.id, {
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
    mutationFn: (contactId: string) => removeStopContact(contactId),
    onSuccess: invalidateStopContacts,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not remove contact."),
  });

  const pickedUpMutation = useMutation({
    mutationFn: markStopPickedUp,
    onSuccess: invalidateStops,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update stop."),
  });
  const deliveredMutation = useMutation({
    mutationFn: markStopDelivered,
    onSuccess: invalidateStops,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update stop."),
  });

  const openAddStop = () => {
    setEditingStop(null);
    setStopForm(EMPTY_STOP_FORM);
    setStopDialogOpen(true);
  };
  const openEditStop = (stop: TripStopRow) => {
    setEditingStop(stop);
    setStopForm(stopFormFromRow(stop));
    setStopDialogOpen(true);
  };

  if (tripQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!tripQuery.data) return <p className="text-sm text-destructive">Trip not found.</p>;
  const trip = tripQuery.data;
  const stops = stopsQuery.data ?? [];

  return (
    <div>
      <Link
        to="/dashboard/operations/trips"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> All trips
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium">{trip.name}</h1>
          {trip.departure_date && (
            <p className="text-sm text-muted-foreground">
              Departs {new Date(trip.departure_date).toLocaleDateString("en-GB")}
            </p>
          )}
        </div>
        <Select
          value={trip.status}
          onValueChange={(v) =>
            statusMutation.mutate(v as Database["public"]["Enums"]["trip_status"])
          }
        >
          <SelectTrigger className="w-40 capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tripStatusOptions.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <section className="mb-6 rounded-2xl border border-border/70 bg-card p-5">
        <h3 className="mb-3 font-display text-base font-semibold">Vehicle & driver</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Vehicle</Label>
            <Select
              value={trip.vehicle_id ?? "none"}
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
              value={trip.driver_id ?? "none"}
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
        <div className="mt-3">
          <Label className="text-xs">Notes</Label>
          <Textarea
            rows={2}
            defaultValue={trip.notes ?? ""}
            onBlur={(e) => {
              if (e.target.value !== (trip.notes ?? "")) notesMutation.mutate(e.target.value);
            }}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold">Stops ({stops.length})</h3>
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
                <div>
                  <Label className="text-xs">Animal</Label>
                  <Input
                    placeholder="e.g. Rex (Labrador)"
                    value={stopForm.animalLabel}
                    onChange={(e) => setStopForm((f) => ({ ...f, animalLabel: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-3 rounded-xl border border-border/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pickup
                  </p>
                  <Input
                    placeholder="https://maps.google.com/…"
                    value={stopForm.pickupMapsUrl}
                    onChange={(e) => setStopForm((f) => ({ ...f, pickupMapsUrl: e.target.value }))}
                  />
                  <Input
                    placeholder="Address"
                    value={stopForm.pickupAddressText}
                    onChange={(e) =>
                      setStopForm((f) => ({ ...f, pickupAddressText: e.target.value }))
                    }
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
                    onChange={(e) => setStopForm((f) => ({ ...f, pickupNotes: e.target.value }))}
                  />
                </div>
                <div className="space-y-3 rounded-xl border border-border/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Dropoff
                  </p>
                  <Input
                    placeholder="https://maps.google.com/…"
                    value={stopForm.dropoffMapsUrl}
                    onChange={(e) => setStopForm((f) => ({ ...f, dropoffMapsUrl: e.target.value }))}
                  />
                  <Input
                    placeholder="Address"
                    value={stopForm.dropoffAddressText}
                    onChange={(e) =>
                      setStopForm((f) => ({ ...f, dropoffAddressText: e.target.value }))
                    }
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
                    onChange={(e) => setStopForm((f) => ({ ...f, dropoffNotes: e.target.value }))}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={stopMutation.isPending}>
                  {editingStop ? "Save changes" : "Add stop"}
                </Button>
              </form>

              {editingStop && (
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

        {!stops.length ? (
          <p className="text-sm text-muted-foreground">No stops on this trip yet.</p>
        ) : (
          <div className="space-y-3">
            {stops.map((s) => (
              <div key={s.id} className="rounded-xl border border-border/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.animal_label}</span>
                    <Badge
                      variant={s.status === "delivered" ? "secondary" : "outline"}
                      className="capitalize"
                    >
                      {s.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
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
                <div className="mt-2 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row">
                  <div className="flex-1">
                    <span className="font-medium text-foreground">Pickup: </span>
                    {s.pickup_address_text || "No address on file"}
                    {s.pickup_contact_phone && (
                      <a
                        href={`tel:${s.pickup_contact_phone}`}
                        className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Phone className="size-3" /> {s.pickup_contact_phone}
                      </a>
                    )}
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-foreground">Dropoff: </span>
                    {s.dropoff_address_text || "No address on file"}
                    {s.dropoff_contact_phone && (
                      <a
                        href={`tel:${s.dropoff_contact_phone}`}
                        className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Phone className="size-3" /> {s.dropoff_contact_phone}
                      </a>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={s.status === "pending" ? "default" : "outline"}
                    disabled={s.status !== "pending" || pickedUpMutation.isPending}
                    onClick={() => pickedUpMutation.mutate(s.id)}
                  >
                    <PackageOpen className="mr-1 size-4" /> Mark picked up
                  </Button>
                  <Button
                    size="sm"
                    variant={s.status === "picked_up" ? "default" : "outline"}
                    disabled={s.status !== "picked_up" || deliveredMutation.isPending}
                    onClick={() => deliveredMutation.mutate(s.id)}
                  >
                    <PackageCheck className="mr-1 size-4" /> Mark delivered
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
