import { useEffect, useState, type ChangeEvent } from "react";
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
  Info,
  MessageCircle,
  UserPlus,
  Car,
  Users,
  Milestone,
  ScanLine,
  Camera,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Badge } from "@/shared/ui/badge";
import { Switch } from "@/shared/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
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
  updateTripStop,
  removeTripStop,
  markStopPickedUp,
  markStopDelivered,
  setTripStatus,
  updateTrip,
  listJoinRequestsForTrip,
  acceptJoinRequestAsStop,
  respondToJoinRequest,
  listStopContacts,
  addStopContact,
  removeStopContact,
  ContactPicker,
  recognizeTransportedMicrochip,
  listStopPhotos,
  getStopPhotoUrl,
  uploadStopPhoto,
  removeStopPhoto,
  type TripStopRow,
  type TripJoinRequestRow,
  type TripStopContactRow,
  type TripStopPhotoRow,
  type RecognizeMicrochipResult,
} from "@/domains/transport";
import { useAuth } from "@/domains/identity";
import { getMyTransportCompany } from "@/domains/breeders";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { useTranslation } from "@/shared/i18n";
import { buildMapsSearchUrl, parseAddressFromMapsUrl } from "@/lib/maps";

export const Route = createFileRoute("/dashboard/transport-company/trips/$tripId")({
  component: TripDetailPage,
});

type StopFormValues = {
  animalLabel: string;
  microchipNumber: string;
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
  microchipNumber: "",
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

function TripDetailPage() {
  const { tripId } = Route.useParams();
  const { t, locale } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [addStopOpen, setAddStopOpen] = useState(false);
  const [originCountry, setOriginCountry] = useState("");
  const [destinationCountry, setDestinationCountry] = useState("");
  const [detailStopId, setDetailStopId] = useState<string | null>(null);

  const companyQuery = useQuery({
    queryKey: ["my-transport-company", userId],
    enabled: !!userId,
    queryFn: () => getMyTransportCompany(userId!),
  });
  const companyId = companyQuery.data?.id ?? null;

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
        microchip_number: values.microchipNumber || null,
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
  const detailStop = stops.find((s) => s.id === detailStopId) ?? null;
  const assignedVehicle = vehiclesQuery.data?.find((v) => v.id === trip?.vehicle_id);
  const assignedDriver = driversQuery.data?.find((d) => d.id === trip?.driver_id);
  const vehicleName = assignedVehicle?.name;
  const driverName = assignedDriver?.name;

  const pickedUpCount = stops.filter((s) => s.status !== "pending").length;
  const deliveredCount = stops.filter((s) => s.status === "delivered").length;
  // "What's next" — the first stop, in planned order, that isn't fully done yet. Directly answers
  // "what dog are we doing / what's next to drop off" from a glance at the top of the page instead
  // of scanning the whole list.
  const nextStop = stops.find((s) => s.status !== "delivered");

  // Every phone number reachable from this trip, flattened into one callable list for the
  // Contacts tab — pickup/dropoff contacts already on each stop only (trip_stop_contacts, the
  // per-stop "extra contacts" added inside StopDetailDialog, stay inside that stop's own dialog
  // rather than being fetched per-stop here, to avoid an N+1 query for a list view).
  const tripContacts: {
    name: string | null;
    phone: string | null;
    role: string;
    stopLabel: string;
  }[] = stops.flatMap((s) => [
    ...(s.pickup_contact_name || s.pickup_contact_phone
      ? [
          {
            name: s.pickup_contact_name,
            phone: s.pickup_contact_phone,
            role: t("transportCompanyPanel.trips.pickupSectionTitle"),
            stopLabel: s.animal_label,
          },
        ]
      : []),
    ...(s.dropoff_contact_name || s.dropoff_contact_phone
      ? [
          {
            name: s.dropoff_contact_name,
            phone: s.dropoff_contact_phone,
            role: t("transportCompanyPanel.trips.dropoffSectionTitle"),
            stopLabel: s.animal_label,
          },
        ]
      : []),
  ]);

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

      <Tabs defaultValue="stops">
        <TabsList className="mb-4 grid h-auto w-full grid-cols-3 gap-1 p-1 sm:inline-flex sm:w-auto">
          <TabsTrigger
            value="stops"
            className="flex-col gap-1 whitespace-normal px-1 py-2 text-center text-[11px] leading-tight sm:flex-row sm:gap-1.5 sm:px-3 sm:text-sm"
          >
            <Milestone className="size-4 shrink-0" /> {t("transportCompanyPanel.trips.tabStops")}
          </TabsTrigger>
          <TabsTrigger
            value="fleet"
            className="flex-col gap-1 whitespace-normal px-1 py-2 text-center text-[11px] leading-tight sm:flex-row sm:gap-1.5 sm:px-3 sm:text-sm"
          >
            <Car className="size-4 shrink-0" /> {t("transportCompanyPanel.trips.tabFleet")}
          </TabsTrigger>
          <TabsTrigger
            value="contacts"
            className="flex-col gap-1 whitespace-normal px-1 py-2 text-center text-[11px] leading-tight sm:flex-row sm:gap-1.5 sm:px-3 sm:text-sm"
          >
            <Users className="size-4 shrink-0" /> {t("transportCompanyPanel.trips.tabContacts")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stops">
          {pendingJoinRequests.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 font-display text-lg font-semibold">
                {t("transportCompanyPanel.trips.joinRequestsTitle")}
              </h2>
              <div className="space-y-3">
                {pendingJoinRequests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-border/70 bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-display text-base font-semibold">
                        {request.animal_label}
                      </h3>
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

                  <div>
                    <Label>{t("transportCompanyPanel.trips.fieldMicrochip")}</Label>
                    <Input
                      placeholder={t("transportCompanyPanel.trips.fieldMicrochipPlaceholder")}
                      {...stopForm.register("microchipNumber")}
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
                        onBlur={(e) => {
                          stopForm.register("pickupMapsUrl").onBlur(e);
                          if (!stopForm.getValues("pickupAddressText").trim()) {
                            const parsed = parseAddressFromMapsUrl(e.target.value);
                            if (parsed) stopForm.setValue("pickupAddressText", parsed);
                          }
                        }}
                      />
                    </div>
                    <div>
                      <Label>{t("transportCompanyPanel.trips.fieldAddressText")}</Label>
                      <Input
                        placeholder={t("transportCompanyPanel.trips.fieldAddressTextPlaceholder")}
                        {...stopForm.register("pickupAddressText")}
                        onBlur={(e) => {
                          stopForm.register("pickupAddressText").onBlur(e);
                          const address = e.target.value.trim();
                          if (address && !stopForm.getValues("pickupMapsUrl").trim()) {
                            stopForm.setValue("pickupMapsUrl", buildMapsSearchUrl(address));
                          }
                        }}
                      />
                    </div>
                    <ContactPicker
                      organizationId={companyId}
                      name={stopForm.watch("pickupContactName")}
                      phone={stopForm.watch("pickupContactPhone")}
                      onChange={({ name, phone }) => {
                        stopForm.setValue("pickupContactName", name);
                        stopForm.setValue("pickupContactPhone", phone);
                      }}
                      nameLabel={t("transportCompanyPanel.trips.fieldContactName")}
                      phoneLabel={t("transportCompanyPanel.trips.fieldContactPhone")}
                    />
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
                        onBlur={(e) => {
                          stopForm.register("dropoffMapsUrl").onBlur(e);
                          if (!stopForm.getValues("dropoffAddressText").trim()) {
                            const parsed = parseAddressFromMapsUrl(e.target.value);
                            if (parsed) stopForm.setValue("dropoffAddressText", parsed);
                          }
                        }}
                      />
                    </div>
                    <div>
                      <Label>{t("transportCompanyPanel.trips.fieldAddressText")}</Label>
                      <Input
                        placeholder={t("transportCompanyPanel.trips.fieldAddressTextPlaceholder")}
                        {...stopForm.register("dropoffAddressText")}
                        onBlur={(e) => {
                          stopForm.register("dropoffAddressText").onBlur(e);
                          const address = e.target.value.trim();
                          if (address && !stopForm.getValues("dropoffMapsUrl").trim()) {
                            stopForm.setValue("dropoffMapsUrl", buildMapsSearchUrl(address));
                          }
                        }}
                      />
                    </div>
                    <ContactPicker
                      organizationId={companyId}
                      name={stopForm.watch("dropoffContactName")}
                      phone={stopForm.watch("dropoffContactPhone")}
                      onChange={({ name, phone }) => {
                        stopForm.setValue("dropoffContactName", name);
                        stopForm.setValue("dropoffContactPhone", phone);
                      }}
                      nameLabel={t("transportCompanyPanel.trips.fieldContactName")}
                      phoneLabel={t("transportCompanyPanel.trips.fieldContactPhone")}
                    />
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
            <p className="text-sm text-muted-foreground">
              {t("transportCompanyPanel.trips.loading")}
            </p>
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
                  onOpenDetails={() => setDetailStopId(stop.id)}
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
        </TabsContent>

        <TabsContent value="fleet">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="text-xs text-muted-foreground">
                {t("transportCompanyPanel.trips.fieldDriver")}
              </div>
              <div className="mt-1 font-display text-lg font-semibold">
                {driverName ?? t("transportCompanyPanel.trips.fieldNone")}
              </div>
              {assignedDriver?.contact && (
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <a href={`tel:${assignedDriver.contact}`}>
                    <Phone className="mr-1 size-3.5" />{" "}
                    {t("transportCompanyPanel.trips.callButton")}
                  </a>
                </Button>
              )}
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="text-xs text-muted-foreground">
                {t("transportCompanyPanel.trips.fieldVehicle")}
              </div>
              <div className="mt-1 font-display text-lg font-semibold">
                {vehicleName ?? t("transportCompanyPanel.trips.fieldNone")}
              </div>
              {assignedVehicle?.registration_number && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {assignedVehicle.registration_number}
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contacts">
          {tripContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("transportCompanyPanel.trips.noContactsYet")}
            </p>
          ) : (
            <div className="space-y-2">
              {tripContacts.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-border/70 bg-card p-3"
                >
                  <div className="text-sm">
                    <div className="font-medium">{c.name || c.role}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.role} · {c.stopLabel}
                    </div>
                  </div>
                  {c.phone && (
                    <Button asChild size="sm" variant="outline">
                      <a href={`tel:${c.phone}`}>
                        <Phone className="mr-1 size-3.5" /> {c.phone}
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {detailStop && (
        <StopDetailDialog
          stop={detailStop}
          companyId={companyId}
          open={!!detailStopId}
          onOpenChange={(open) => setDetailStopId(open ? detailStop.id : null)}
          onMarkPickedUp={() => pickedUpMutation.mutate(detailStop.id)}
          onMarkDelivered={() => deliveredMutation.mutate(detailStop.id)}
          markingPickedUp={pickedUpMutation.isPending}
          markingDelivered={deliveredMutation.isPending}
        />
      )}
    </div>
  );
}

function ContactBlock({
  title,
  mapsUrl,
  addressText,
  contactName,
  contactPhone,
  notes,
}: {
  title: string;
  mapsUrl: string | null;
  addressText?: string | null;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 rounded-xl bg-secondary/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {addressText && (
        <p className="mt-1 flex items-start gap-1 text-sm text-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> {addressText}
        </p>
      )}
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
  onOpenDetails,
  onMarkPickedUp,
  onMarkDelivered,
  onRemove,
  markingPickedUp,
  markingDelivered,
  removing,
}: {
  stop: TripStopRow;
  onOpenDetails: () => void;
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
        <button
          type="button"
          onClick={onOpenDetails}
          className="flex items-center gap-2 text-left hover:underline"
        >
          <h3 className="font-display text-base font-semibold">{stop.animal_label}</h3>
          <Badge
            variant={stop.status === "delivered" ? "secondary" : "outline"}
            className="capitalize"
          >
            {t(`transportCompanyPanel.trips.stopStatus.${stop.status}`)}
          </Badge>
        </button>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onOpenDetails}>
            <Info className="mr-1 size-4" /> {t("transportCompanyPanel.trips.viewDetails")}
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

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <ContactBlock
          title={t("transportCompanyPanel.trips.pickupSectionTitle")}
          mapsUrl={stop.pickup_maps_url}
          addressText={stop.pickup_address_text}
          contactName={stop.pickup_contact_name}
          contactPhone={stop.pickup_contact_phone}
          notes={stop.pickup_notes}
        />
        <ContactBlock
          title={t("transportCompanyPanel.trips.dropoffSectionTitle")}
          mapsUrl={stop.dropoff_maps_url}
          addressText={stop.dropoff_address_text}
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

// The "click into a stop and see everything" view: editable pickup/dropoff address+contact detail
// (autosaved on blur, same convention as the trip visibility fields above) plus the stop's extra
// contacts (trip_stop_contacts) — real handovers often need more than the two primary contacts
// already on the stop itself (e.g. a breeder AND whoever meets the van).
function StopDetailDialog({
  stop,
  companyId,
  open,
  onOpenChange,
  onMarkPickedUp,
  onMarkDelivered,
  markingPickedUp,
  markingDelivered,
}: {
  stop: TripStopRow;
  companyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkPickedUp: () => void;
  onMarkDelivered: () => void;
  markingPickedUp: boolean;
  markingDelivered: boolean;
}) {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const [fields, setFields] = useState({
    pickup_maps_url: stop.pickup_maps_url ?? "",
    pickup_address_text: stop.pickup_address_text ?? "",
    pickup_contact_name: stop.pickup_contact_name ?? "",
    pickup_contact_phone: stop.pickup_contact_phone ?? "",
    pickup_notes: stop.pickup_notes ?? "",
    dropoff_maps_url: stop.dropoff_maps_url ?? "",
    dropoff_address_text: stop.dropoff_address_text ?? "",
    dropoff_contact_name: stop.dropoff_contact_name ?? "",
    dropoff_contact_phone: stop.dropoff_contact_phone ?? "",
    dropoff_notes: stop.dropoff_notes ?? "",
    microchip_number: stop.microchip_number ?? "",
  });

  useEffect(() => {
    setFields({
      pickup_maps_url: stop.pickup_maps_url ?? "",
      pickup_address_text: stop.pickup_address_text ?? "",
      pickup_contact_name: stop.pickup_contact_name ?? "",
      pickup_contact_phone: stop.pickup_contact_phone ?? "",
      pickup_notes: stop.pickup_notes ?? "",
      dropoff_maps_url: stop.dropoff_maps_url ?? "",
      dropoff_address_text: stop.dropoff_address_text ?? "",
      dropoff_contact_name: stop.dropoff_contact_name ?? "",
      dropoff_contact_phone: stop.dropoff_contact_phone ?? "",
      dropoff_notes: stop.dropoff_notes ?? "",
      microchip_number: stop.microchip_number ?? "",
    });
  }, [stop]);

  // Debounced "instant recognition" — fires a moment after the microchip field stops changing,
  // not on every keystroke. Silent on no-match (the common case); never an error state for "not
  // found." See recognize_transported_microchip()'s own header for the privacy boundary (counts/
  // dates/company names only, never another company's raw trip data).
  const [recognition, setRecognition] = useState<RecognizeMicrochipResult | null>(null);
  const recognizeMutation = useMutation({
    mutationFn: recognizeTransportedMicrochip,
    onSuccess: (result) => setRecognition(result && result.times_transported > 0 ? result : null),
  });
  useEffect(() => {
    const trimmed = fields.microchip_number.trim();
    if (!trimmed) {
      setRecognition(null);
      return;
    }
    const timeout = setTimeout(() => recognizeMutation.mutate(trimmed), 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires on the field value only
  }, [fields.microchip_number]);

  const photosQuery = useQuery({
    queryKey: ["trip-stop-photos", stop.id],
    queryFn: () => listStopPhotos(stop.id),
  });
  const invalidatePhotos = () =>
    queryClient.invalidateQueries({ queryKey: ["trip-stop-photos", stop.id] });
  const uploadPhotoMutation = useMutation({
    mutationFn: (file: File) => uploadStopPhoto(stop.id, file, userId!),
    onSuccess: invalidatePhotos,
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("transportCompanyPanel.trips.stopSaveFailed"))),
  });
  const removePhotoMutation = useMutation({
    mutationFn: (photo: TripStopPhotoRow) => removeStopPhoto(photo.id, photo.storage_path),
    onSuccess: invalidatePhotos,
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("transportCompanyPanel.trips.stopUpdateFailed"))),
  });

  const invalidateStops = () =>
    queryClient.invalidateQueries({ queryKey: ["trip-stops", stop.trip_id] });

  const saveMutation = useMutation({
    mutationFn: (patch: Partial<typeof fields>) => updateTripStop(stop.id, patch),
    onSuccess: invalidateStops,
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("transportCompanyPanel.trips.stopUpdateFailed"))),
  });

  const contactsQuery = useQuery({
    queryKey: ["trip-stop-contacts", stop.id],
    queryFn: () => listStopContacts(stop.id),
  });
  const invalidateContacts = () =>
    queryClient.invalidateQueries({ queryKey: ["trip-stop-contacts", stop.id] });

  const [contactForm, setContactForm] = useState({
    role_label: "",
    contact_name: "",
    contact_phone: "",
    messenger_name: "",
  });
  const addContactMutation = useMutation({
    mutationFn: () =>
      addStopContact(stop.id, {
        role_label: contactForm.role_label || null,
        contact_name: contactForm.contact_name,
        contact_phone: contactForm.contact_phone || null,
        messenger_name: contactForm.messenger_name || null,
      }),
    onSuccess: () => {
      setContactForm({ role_label: "", contact_name: "", contact_phone: "", messenger_name: "" });
      invalidateContacts();
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("transportCompanyPanel.trips.stopSaveFailed"))),
  });
  const removeContactMutation = useMutation({
    mutationFn: removeStopContact,
    onSuccess: invalidateContacts,
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("transportCompanyPanel.trips.stopUpdateFailed"))),
  });

  const field = (key: keyof typeof fields) => ({
    value: fields[key],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFields((f) => ({ ...f, [key]: e.target.value })),
    onBlur: () => {
      if (fields[key] !== (stop[key] ?? "")) saveMutation.mutate({ [key]: fields[key] || null });
    },
  });

  // Same as field(), but for an address-text input specifically: also auto-generates a plain
  // Google Maps search link (buildMapsSearchUrl — no API key, just a deep link Maps itself
  // resolves) into the paired *_maps_url field whenever that field is still empty. Never
  // overwrites a link someone already pasted in by hand.
  const addressField = (addressKey: "pickup_address_text" | "dropoff_address_text") => {
    const mapsKey = addressKey === "pickup_address_text" ? "pickup_maps_url" : "dropoff_maps_url";
    return {
      value: fields[addressKey],
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setFields((f) => ({ ...f, [addressKey]: e.target.value })),
      onBlur: () => {
        const patch: Partial<typeof fields> = {};
        if (fields[addressKey] !== (stop[addressKey] ?? "")) patch[addressKey] = fields[addressKey];
        if (fields[addressKey].trim() && !fields[mapsKey].trim()) {
          const generated = buildMapsSearchUrl(fields[addressKey]);
          patch[mapsKey] = generated;
          setFields((f) => ({ ...f, [mapsKey]: generated }));
        }
        if (Object.keys(patch).length) {
          saveMutation.mutate(
            Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v || null])),
          );
        }
      },
    };
  };

  // The reverse direction — pasting a Maps link auto-fills the address field when it's still
  // empty (parseAddressFromMapsUrl returns null for link shapes with no extractable address, in
  // which case this is a no-op, same as addressField() above never overwriting a manual link).
  const mapsUrlField = (mapsKey: "pickup_maps_url" | "dropoff_maps_url") => {
    const addressKey =
      mapsKey === "pickup_maps_url" ? "pickup_address_text" : "dropoff_address_text";
    return {
      value: fields[mapsKey],
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setFields((f) => ({ ...f, [mapsKey]: e.target.value })),
      onBlur: () => {
        const patch: Partial<typeof fields> = {};
        if (fields[mapsKey] !== (stop[mapsKey] ?? "")) patch[mapsKey] = fields[mapsKey];
        if (fields[mapsKey].trim() && !fields[addressKey].trim()) {
          const parsed = parseAddressFromMapsUrl(fields[mapsKey]);
          if (parsed) {
            patch[addressKey] = parsed;
            setFields((f) => ({ ...f, [addressKey]: parsed }));
          }
        }
        if (Object.keys(patch).length) {
          saveMutation.mutate(
            Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v || null])),
          );
        }
      },
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {stop.animal_label}
            <Badge
              variant={stop.status === "delivered" ? "secondary" : "outline"}
              className="capitalize"
            >
              {t(`transportCompanyPanel.trips.stopStatus.${stop.status}`)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("transportCompanyPanel.trips.pickupSectionTitle")}
            </p>
            <div>
              <Label>{t("transportCompanyPanel.trips.fieldMapsUrl")}</Label>
              <Input placeholder="https://maps.google.com/…" {...mapsUrlField("pickup_maps_url")} />
            </div>
            <div>
              <Label>{t("transportCompanyPanel.trips.fieldAddressText")}</Label>
              <Input
                placeholder={t("transportCompanyPanel.trips.fieldAddressTextPlaceholder")}
                {...addressField("pickup_address_text")}
              />
            </div>
            <ContactPicker
              organizationId={companyId}
              name={fields.pickup_contact_name}
              phone={fields.pickup_contact_phone}
              onChange={({ name, phone }) =>
                setFields((f) => ({ ...f, pickup_contact_name: name, pickup_contact_phone: phone }))
              }
              onBlur={({ name, phone }) => {
                const patch: Record<string, string | null> = {};
                if (name !== (stop.pickup_contact_name ?? ""))
                  patch.pickup_contact_name = name || null;
                if (phone !== (stop.pickup_contact_phone ?? ""))
                  patch.pickup_contact_phone = phone || null;
                if (Object.keys(patch).length) saveMutation.mutate(patch);
              }}
              nameLabel={t("transportCompanyPanel.trips.fieldContactName")}
              phoneLabel={t("transportCompanyPanel.trips.fieldContactPhone")}
            />
            <div>
              <Label>{t("transportCompanyPanel.trips.fieldNotes")}</Label>
              <Textarea rows={2} {...field("pickup_notes")} />
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
                {...mapsUrlField("dropoff_maps_url")}
              />
            </div>
            <div>
              <Label>{t("transportCompanyPanel.trips.fieldAddressText")}</Label>
              <Input
                placeholder={t("transportCompanyPanel.trips.fieldAddressTextPlaceholder")}
                {...addressField("dropoff_address_text")}
              />
            </div>
            <ContactPicker
              organizationId={companyId}
              name={fields.dropoff_contact_name}
              phone={fields.dropoff_contact_phone}
              onChange={({ name, phone }) =>
                setFields((f) => ({
                  ...f,
                  dropoff_contact_name: name,
                  dropoff_contact_phone: phone,
                }))
              }
              onBlur={({ name, phone }) => {
                const patch: Record<string, string | null> = {};
                if (name !== (stop.dropoff_contact_name ?? ""))
                  patch.dropoff_contact_name = name || null;
                if (phone !== (stop.dropoff_contact_phone ?? ""))
                  patch.dropoff_contact_phone = phone || null;
                if (Object.keys(patch).length) saveMutation.mutate(patch);
              }}
              nameLabel={t("transportCompanyPanel.trips.fieldContactName")}
              phoneLabel={t("transportCompanyPanel.trips.fieldContactPhone")}
            />
            <div>
              <Label>{t("transportCompanyPanel.trips.fieldNotes")}</Label>
              <Textarea rows={2} {...field("dropoff_notes")} />
            </div>
          </div>

          <div className="rounded-xl border border-border/60 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("transportCompanyPanel.trips.extraContactsTitle")}
            </p>
            {(contactsQuery.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("transportCompanyPanel.trips.noExtraContacts")}
              </p>
            ) : (
              <div className="space-y-2">
                {(contactsQuery.data ?? []).map((c) => (
                  <ExtraContactRow
                    key={c.id}
                    contact={c}
                    onRemove={() => removeContactMutation.mutate(c.id)}
                    removing={removeContactMutation.isPending}
                  />
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
              <Input
                placeholder={t("transportCompanyPanel.trips.fieldRoleLabel")}
                value={contactForm.role_label}
                onChange={(e) => setContactForm((f) => ({ ...f, role_label: e.target.value }))}
              />
              <Input
                placeholder={t("transportCompanyPanel.trips.fieldContactName")}
                value={contactForm.contact_name}
                onChange={(e) => setContactForm((f) => ({ ...f, contact_name: e.target.value }))}
              />
              <Input
                placeholder={t("transportCompanyPanel.trips.fieldContactPhone")}
                value={contactForm.contact_phone}
                onChange={(e) => setContactForm((f) => ({ ...f, contact_phone: e.target.value }))}
              />
              <Input
                placeholder={t("transportCompanyPanel.trips.fieldMessengerName")}
                value={contactForm.messenger_name}
                onChange={(e) => setContactForm((f) => ({ ...f, messenger_name: e.target.value }))}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={!contactForm.contact_name.trim() || addContactMutation.isPending}
              onClick={() => addContactMutation.mutate()}
            >
              <UserPlus className="mr-1 size-4" /> {t("transportCompanyPanel.trips.addContact")}
            </Button>
          </div>

          <div className="rounded-xl border border-border/60 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("transportCompanyPanel.trips.microchipSectionTitle")}
            </p>
            <div>
              <Label>{t("transportCompanyPanel.trips.fieldMicrochip")}</Label>
              <Input
                placeholder={t("transportCompanyPanel.trips.fieldMicrochipPlaceholder")}
                {...field("microchip_number")}
              />
            </div>
            {recognition && (
              <div className="flex items-start gap-2 rounded-lg bg-accent/10 p-3 text-sm">
                <ScanLine className="mt-0.5 size-4 shrink-0 text-accent" />
                <div>
                  <p className="font-medium">{t("transportCompanyPanel.trips.recognizedTitle")}</p>
                  <p className="text-xs text-muted-foreground">
                    {recognition.times_transported === 1
                      ? t("transportCompanyPanel.trips.recognizedOnce")
                      : `${t("transportCompanyPanel.trips.recognizedTimesPrefix")} ${recognition.times_transported} ${t("transportCompanyPanel.trips.recognizedTimesSuffix")}`}
                    {recognition.last_transported_at &&
                      ` · ${t("transportCompanyPanel.trips.recognizedLastSeen")} ${new Date(recognition.last_transported_at).toLocaleDateString("en-GB")}`}
                  </p>
                  {!!recognition.companies?.length && (
                    <p className="text-xs text-muted-foreground">
                      {t("transportCompanyPanel.trips.recognizedByPrefix")}{" "}
                      {recognition.companies.join(", ")}
                    </p>
                  )}
                  {recognition.known_pedigree_dog_slug && (
                    <Link
                      to="/dogs/$slug"
                      params={{ slug: recognition.known_pedigree_dog_slug }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {t("transportCompanyPanel.trips.viewPedigreeProfile")}
                    </Link>
                  )}
                </div>
              </div>
            )}

            <div>
              <Label>{t("transportCompanyPanel.trips.photosLabel")}</Label>
              {photosQuery.isLoading ? null : (photosQuery.data ?? []).length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(photosQuery.data ?? []).map((photo) => (
                    <StopPhotoThumb
                      key={photo.id}
                      photo={photo}
                      onRemove={() => removePhotoMutation.mutate(photo)}
                      removing={removePhotoMutation.isPending}
                    />
                  ))}
                </div>
              ) : null}
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-primary hover:underline">
                <Camera className="size-4" /> {t("transportCompanyPanel.trips.addPhoto")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadPhotoMutation.isPending}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadPhotoMutation.mutate(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={stop.status === "pending" ? "default" : "outline"}
              disabled={stop.status !== "pending" || markingPickedUp}
              onClick={onMarkPickedUp}
            >
              <PackageOpen className="mr-1 size-4" />{" "}
              {t("transportCompanyPanel.trips.markPickedUp")}
            </Button>
            <Button
              size="sm"
              variant={stop.status === "picked_up" ? "default" : "outline"}
              disabled={stop.status !== "picked_up" || markingDelivered}
              onClick={onMarkDelivered}
            >
              <PackageCheck className="mr-1 size-4" />{" "}
              {t("transportCompanyPanel.trips.markDelivered")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExtraContactRow({
  contact,
  onRemove,
  removing,
}: {
  contact: TripStopContactRow;
  onRemove: () => void;
  removing: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start justify-between gap-2 rounded-lg bg-secondary/40 p-2">
      <div className="text-sm">
        <div className="font-medium">
          {contact.contact_name}
          {contact.role_label && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              ({contact.role_label})
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {contact.contact_phone && (
            <a
              href={`tel:${contact.contact_phone}`}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <Phone className="size-3" /> {contact.contact_phone}
            </a>
          )}
          {contact.messenger_name && (
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="size-3" /> {contact.messenger_name}
            </span>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive"
        disabled={removing}
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

// A trip-stop-photos object is only ever viewable through a short-lived signed URL (the bucket is
// private) — resolved on demand per thumbnail, same posture as every other private-bucket viewer
// in this app (see getSignedFileUrl's own doc comment in src/lib/storage/media.ts).
function StopPhotoThumb({
  photo,
  onRemove,
  removing,
}: {
  photo: TripStopPhotoRow;
  onRemove: () => void;
  removing: boolean;
}) {
  const urlQuery = useQuery({
    queryKey: ["trip-stop-photo-url", photo.id],
    queryFn: () => getStopPhotoUrl(photo.storage_path),
  });
  return (
    <div className="group relative size-20 overflow-hidden rounded-lg border border-border/60 bg-secondary/40">
      {urlQuery.data && (
        <img src={urlQuery.data} alt="" className="size-full object-cover" loading="lazy" />
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={removing}
        onClick={onRemove}
        className="absolute right-0.5 top-0.5 size-6 bg-background/80 p-0 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Trash2 className="size-3" />
      </Button>
    </div>
  );
}
