import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  MapPin,
  Phone,
  PackageCheck,
  PackageOpen,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Badge } from "@/shared/ui/badge";
import { Switch } from "@/shared/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import {
  listVehicles,
  listDrivers,
  getTrip,
  listTripStops,
  addTripStop,
  removeTripStop,
  markStopPickedUp,
  markStopDelivered,
  setTripStatus,
  updateTrip,
  listJoinRequestsForTrip,
  acceptJoinRequestAsStop,
  respondToJoinRequest,
  type TripStopRow,
  type TripJoinRequestRow,
} from "@/domains/transport";
import { useAuth } from "@/domains/identity";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/transport-company/trips/$tripId")({
  component: TripDetailPage,
});

type StopFormValues = {
  animalLabel: string;
  pickupMapsUrl: string;
  pickupContactName: string;
  pickupContactPhone: string;
  pickupNotes: string;
  dropoffMapsUrl: string;
  dropoffContactName: string;
  dropoffContactPhone: string;
  dropoffNotes: string;
};

const EMPTY_STOP_FORM: StopFormValues = {
  animalLabel: "",
  pickupMapsUrl: "",
  pickupContactName: "",
  pickupContactPhone: "",
  pickupNotes: "",
  dropoffMapsUrl: "",
  dropoffContactName: "",
  dropoffContactPhone: "",
  dropoffNotes: "",
};

function TripDetailPage() {
  const { tripId } = Route.useParams();
  const { t, locale } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [addStopOpen, setAddStopOpen] = useState(false);
  const [originCountry, setOriginCountry] = useState("");
  const [destinationCountry, setDestinationCountry] = useState("");

  const tripQuery = useQuery({ queryKey: ["trip", tripId], queryFn: () => getTrip(tripId) });
  const stopsQuery = useQuery({
    queryKey: ["trip-stops", tripId],
    queryFn: () => listTripStops(tripId),
  });
  const joinRequestsQuery = useQuery({
    queryKey: ["trip-join-requests", tripId],
    queryFn: () => listJoinRequestsForTrip(tripId),
  });
  // Only fetched to resolve the trip's own vehicle_id/driver_id into a display name — same
  // RLS-scoped queries as the Vehicles/Drivers pages, no extra org filter needed.
  const vehiclesQuery = useQuery({ queryKey: ["vehicles"], queryFn: listVehicles });
  const driversQuery = useQuery({ queryKey: ["drivers"], queryFn: listDrivers });

  const invalidateStops = () => queryClient.invalidateQueries({ queryKey: ["trip-stops", tripId] });
  const invalidateTrip = () => queryClient.invalidateQueries({ queryKey: ["trip", tripId] });

  const stopForm = useForm<StopFormValues>({ defaultValues: EMPTY_STOP_FORM });

  const addStopMutation = useMutation({
    mutationFn: (values: StopFormValues) =>
      addTripStop(tripId, {
        animal_label: values.animalLabel,
        pickup_maps_url: values.pickupMapsUrl || null,
        pickup_contact_name: values.pickupContactName || null,
        pickup_contact_phone: values.pickupContactPhone || null,
        pickup_notes: values.pickupNotes || null,
        dropoff_maps_url: values.dropoffMapsUrl || null,
        dropoff_contact_name: values.dropoffContactName || null,
        dropoff_contact_phone: values.dropoffContactPhone || null,
        dropoff_notes: values.dropoffNotes || null,
      }),
    onSuccess: () => {
      toast.success(t("transportCompanyPanel.trips.stopAddedToast"));
      setAddStopOpen(false);
      stopForm.reset(EMPTY_STOP_FORM);
      invalidateStops();
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("transportCompanyPanel.trips.stopSaveFailed"))),
  });

  const pickedUpMutation = useMutation({
    mutationFn: markStopPickedUp,
    onSuccess: invalidateStops,
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("transportCompanyPanel.trips.stopUpdateFailed"))),
  });
  const deliveredMutation = useMutation({
    mutationFn: markStopDelivered,
    onSuccess: invalidateStops,
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("transportCompanyPanel.trips.stopUpdateFailed"))),
  });
  const removeMutation = useMutation({
    mutationFn: removeTripStop,
    onSuccess: () => {
      toast.success(t("transportCompanyPanel.trips.stopRemovedToast"));
      invalidateStops();
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("transportCompanyPanel.trips.stopUpdateFailed"))),
  });
  const statusMutation = useMutation({
    mutationFn: (status: "completed" | "cancelled") => setTripStatus(tripId, status),
    onSuccess: invalidateTrip,
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("transportCompanyPanel.trips.tripUpdateFailed"))),
  });

  const visibilityMutation = useMutation({
    mutationFn: (patch: {
      is_public?: boolean;
      origin_country?: string | null;
      destination_country?: string | null;
    }) => updateTrip(tripId, patch),
    onSuccess: invalidateTrip,
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("transportCompanyPanel.trips.tripUpdateFailed"))),
  });

  const invalidateJoinRequests = () =>
    queryClient.invalidateQueries({ queryKey: ["trip-join-requests", tripId] });

  const acceptJoinRequestMutation = useMutation({
    mutationFn: (request: TripJoinRequestRow) => acceptJoinRequestAsStop(request, userId!),
    onSuccess: () => {
      toast.success(t("transportCompanyPanel.trips.joinRequestAcceptedToast"));
      invalidateJoinRequests();
      invalidateStops();
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("transportCompanyPanel.trips.stopUpdateFailed"))),
  });
  const declineJoinRequestMutation = useMutation({
    mutationFn: (requestId: string) => respondToJoinRequest(requestId, "declined", userId!),
    onSuccess: invalidateJoinRequests,
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("transportCompanyPanel.trips.stopUpdateFailed"))),
  });

  const trip = tripQuery.data;

  useEffect(() => {
    if (!trip) return;
    setOriginCountry(trip.origin_country ?? "");
    setDestinationCountry(trip.destination_country ?? "");
  }, [trip]);

  const pendingJoinRequests = (joinRequestsQuery.data ?? []).filter((r) => r.status === "pending");
  const stops = stopsQuery.data ?? [];
  const vehicleName = vehiclesQuery.data?.find((v) => v.id === trip?.vehicle_id)?.name;
  const driverName = driversQuery.data?.find((d) => d.id === trip?.driver_id)?.name;

  const pickedUpCount = stops.filter((s) => s.status !== "pending").length;
  const deliveredCount = stops.filter((s) => s.status === "delivered").length;
  // "What's next" — the first stop, in planned order, that isn't fully done yet. Directly answers
  // "what dog are we doing / what's next to drop off" from a glance at the top of the page instead
  // of scanning the whole list.
  const nextStop = stops.find((s) => s.status !== "delivered");

  if (tripQuery.isLoading || !trip) {
    return (
      <p className="text-sm text-muted-foreground">{t("transportCompanyPanel.trips.loading")}</p>
    );
  }

  return (
    <div>
      <Link
        to="/dashboard/transport-company/trips"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {t("transportCompanyPanel.trips.backToTrips")}
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-medium">{trip.name}</h1>
            <Badge variant="secondary" className="capitalize">
              {t(`transportCompanyPanel.trips.status.${trip.status}`)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {trip.departure_date &&
              new Date(trip.departure_date).toLocaleDateString(locale === "pl" ? "pl-PL" : "en-GB")}
            {vehicleName && ` · ${vehicleName}`}
            {driverName && ` · ${driverName}`}
          </p>
          {trip.notes && (
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{trip.notes}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {trip.route_maps_url && (
            <Button asChild variant="outline" size="sm">
              <a href={trip.route_maps_url} target="_blank" rel="noreferrer">
                <MapPin className="mr-1 size-4" /> {t("transportCompanyPanel.trips.openFullRoute")}
              </a>
            </Button>
          )}
          {trip.status !== "completed" && trip.status !== "cancelled" && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate("completed")}
              >
                <CheckCircle2 className="mr-1 size-4" />{" "}
                {t("transportCompanyPanel.trips.markCompleted")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate("cancelled")}
              >
                <XCircle className="mr-1 size-4" /> {t("transportCompanyPanel.trips.cancelTrip")}
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="mb-6 rounded-2xl border border-border/70 bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              {t("transportCompanyPanel.trips.publicToggleLabel")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("transportCompanyPanel.trips.publicToggleHelp")}
            </p>
          </div>
          <Switch
            checked={trip.is_public}
            disabled={visibilityMutation.isPending}
            onCheckedChange={(checked) => visibilityMutation.mutate({ is_public: checked })}
          />
        </div>
        {trip.is_public && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label>{t("transportCompanyPanel.trips.fieldOriginCountry")}</Label>
              <Input
                value={originCountry}
                onChange={(e) => setOriginCountry(e.target.value)}
                onBlur={() => visibilityMutation.mutate({ origin_country: originCountry || null })}
                placeholder="e.g. Poland"
              />
            </div>
            <div>
              <Label>{t("transportCompanyPanel.trips.fieldDestinationCountry")}</Label>
              <Input
                value={destinationCountry}
                onChange={(e) => setDestinationCountry(e.target.value)}
                onBlur={() =>
                  visibilityMutation.mutate({ destination_country: destinationCountry || null })
                }
                placeholder="e.g. Netherlands"
              />
            </div>
          </div>
        )}
      </div>

      {pendingJoinRequests.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 font-display text-lg font-semibold">
            {t("transportCompanyPanel.trips.joinRequestsTitle")}
          </h2>
          <div className="space-y-3">
            {pendingJoinRequests.map((request) => (
              <div key={request.id} className="rounded-2xl border border-border/70 bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-base font-semibold">{request.animal_label}</h3>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={acceptJoinRequestMutation.isPending}
                      onClick={() => acceptJoinRequestMutation.mutate(request)}
                    >
                      {t("transportCompanyPanel.trips.acceptJoinRequest")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={declineJoinRequestMutation.isPending}
                      onClick={() => declineJoinRequestMutation.mutate(request.id)}
                    >
                      {t("transportCompanyPanel.trips.declineJoinRequest")}
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <ContactBlock
                    title={t("transportCompanyPanel.trips.pickupSectionTitle")}
                    mapsUrl={request.pickup_maps_url}
                    contactName={request.pickup_contact_name}
                    contactPhone={request.pickup_contact_phone}
                    notes={null}
                  />
                  <ContactBlock
                    title={t("transportCompanyPanel.trips.dropoffSectionTitle")}
                    mapsUrl={request.dropoff_maps_url}
                    contactName={request.dropoff_contact_name}
                    contactPhone={request.dropoff_contact_phone}
                    notes={request.notes}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stops.length > 0 && (
        <div className="mb-6 grid gap-4 grid-cols-1 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="text-xs text-muted-foreground">
              {t("transportCompanyPanel.trips.progressPickedUp")}
            </div>
            <div className="mt-1 font-display text-2xl font-semibold">
              {pickedUpCount} / {stops.length}
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="text-xs text-muted-foreground">
              {t("transportCompanyPanel.trips.progressDelivered")}
            </div>
            <div className="mt-1 font-display text-2xl font-semibold">
              {deliveredCount} / {stops.length}
            </div>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="text-xs text-muted-foreground">
              {t("transportCompanyPanel.trips.nextUp")}
            </div>
            <div className="mt-1 font-display text-lg font-semibold">
              {nextStop
                ? `${nextStop.animal_label} — ${
                    nextStop.status === "pending"
                      ? t("transportCompanyPanel.trips.nextActionPickup")
                      : t("transportCompanyPanel.trips.nextActionDropoff")
                  }`
                : t("transportCompanyPanel.trips.nextUpDone")}
            </div>
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">
          {t("transportCompanyPanel.trips.stopsTitle")}
        </h2>
        <Dialog open={addStopOpen} onOpenChange={setAddStopOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 size-4" /> {t("transportCompanyPanel.trips.addStopButton")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("transportCompanyPanel.trips.addStopButton")}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={stopForm.handleSubmit((v) => addStopMutation.mutate(v))}
              className="space-y-4"
            >
              <div>
                <Label>{t("transportCompanyPanel.trips.fieldAnimalLabel")}</Label>
                <Input
                  placeholder={t("transportCompanyPanel.trips.fieldAnimalLabelPlaceholder")}
                  {...stopForm.register("animalLabel", { required: true })}
                />
              </div>

              <div className="rounded-xl border border-border/60 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("transportCompanyPanel.trips.pickupSectionTitle")}
                </p>
                <div>
                  <Label>{t("transportCompanyPanel.trips.fieldMapsUrl")}</Label>
                  <Input
                    placeholder="https://maps.google.com/…"
                    {...stopForm.register("pickupMapsUrl")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("transportCompanyPanel.trips.fieldContactName")}</Label>
                    <Input {...stopForm.register("pickupContactName")} />
                  </div>
                  <div>
                    <Label>{t("transportCompanyPanel.trips.fieldContactPhone")}</Label>
                    <Input {...stopForm.register("pickupContactPhone")} />
                  </div>
                </div>
                <div>
                  <Label>{t("transportCompanyPanel.trips.fieldNotes")}</Label>
                  <Textarea rows={2} {...stopForm.register("pickupNotes")} />
                </div>
              </div>

              <div className="rounded-xl border border-border/60 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("transportCompanyPanel.trips.dropoffSectionTitle")}
                </p>
                <div>
                  <Label>{t("transportCompanyPanel.trips.fieldMapsUrl")}</Label>
                  <Input
                    placeholder="https://maps.google.com/…"
                    {...stopForm.register("dropoffMapsUrl")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("transportCompanyPanel.trips.fieldContactName")}</Label>
                    <Input {...stopForm.register("dropoffContactName")} />
                  </div>
                  <div>
                    <Label>{t("transportCompanyPanel.trips.fieldContactPhone")}</Label>
                    <Input {...stopForm.register("dropoffContactPhone")} />
                  </div>
                </div>
                <div>
                  <Label>{t("transportCompanyPanel.trips.fieldNotes")}</Label>
                  <Textarea rows={2} {...stopForm.register("dropoffNotes")} />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={addStopMutation.isPending}>
                {t("transportCompanyPanel.trips.addStopButton")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {stopsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("transportCompanyPanel.trips.loading")}</p>
      ) : !stops.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t("transportCompanyPanel.trips.noStopsYet")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {stops.map((stop) => (
            <StopCard
              key={stop.id}
              stop={stop}
              onMarkPickedUp={() => pickedUpMutation.mutate(stop.id)}
              onMarkDelivered={() => deliveredMutation.mutate(stop.id)}
              onRemove={() => removeMutation.mutate(stop.id)}
              markingPickedUp={pickedUpMutation.isPending}
              markingDelivered={deliveredMutation.isPending}
              removing={removeMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ContactBlock({
  title,
  mapsUrl,
  contactName,
  contactPhone,
  notes,
}: {
  title: string;
  mapsUrl: string | null;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 rounded-xl bg-secondary/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {mapsUrl ? (
          <Button asChild size="sm" variant="outline">
            <a href={mapsUrl} target="_blank" rel="noreferrer">
              <MapPin className="mr-1 size-3.5" /> {t("transportCompanyPanel.trips.openMaps")}
            </a>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            {t("transportCompanyPanel.trips.noMapsLink")}
          </span>
        )}
        {contactPhone && (
          <Button asChild size="sm" variant="outline">
            <a href={`tel:${contactPhone}`}>
              <Phone className="mr-1 size-3.5" /> {contactName || contactPhone}
            </a>
          </Button>
        )}
      </div>
      {!contactPhone && contactName && (
        <p className="mt-1.5 text-sm text-muted-foreground">{contactName}</p>
      )}
      {notes && <p className="mt-1.5 text-xs text-muted-foreground">{notes}</p>}
    </div>
  );
}

function StopCard({
  stop,
  onMarkPickedUp,
  onMarkDelivered,
  onRemove,
  markingPickedUp,
  markingDelivered,
  removing,
}: {
  stop: TripStopRow;
  onMarkPickedUp: () => void;
  onMarkDelivered: () => void;
  onRemove: () => void;
  markingPickedUp: boolean;
  markingDelivered: boolean;
  removing: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-base font-semibold">{stop.animal_label}</h3>
          <Badge
            variant={stop.status === "delivered" ? "secondary" : "outline"}
            className="capitalize"
          >
            {t(`transportCompanyPanel.trips.stopStatus.${stop.status}`)}
          </Badge>
        </div>
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

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <ContactBlock
          title={t("transportCompanyPanel.trips.pickupSectionTitle")}
          mapsUrl={stop.pickup_maps_url}
          contactName={stop.pickup_contact_name}
          contactPhone={stop.pickup_contact_phone}
          notes={stop.pickup_notes}
        />
        <ContactBlock
          title={t("transportCompanyPanel.trips.dropoffSectionTitle")}
          mapsUrl={stop.dropoff_maps_url}
          contactName={stop.dropoff_contact_name}
          contactPhone={stop.dropoff_contact_phone}
          notes={stop.dropoff_notes}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={stop.status === "pending" ? "default" : "outline"}
          disabled={stop.status !== "pending" || markingPickedUp}
          onClick={onMarkPickedUp}
        >
          <PackageOpen className="mr-1 size-4" /> {t("transportCompanyPanel.trips.markPickedUp")}
        </Button>
        <Button
          size="sm"
          variant={stop.status === "picked_up" ? "default" : "outline"}
          disabled={stop.status !== "picked_up" || markingDelivered}
          onClick={onMarkDelivered}
        >
          <PackageCheck className="mr-1 size-4" /> {t("transportCompanyPanel.trips.markDelivered")}
        </Button>
      </div>
    </div>
  );
}
