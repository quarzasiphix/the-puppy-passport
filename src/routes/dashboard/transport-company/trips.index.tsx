import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, MapPinned } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Badge } from "@/shared/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { useAuth } from "@/domains/identity";
import { getMyTransportCompany } from "@/domains/breeders";
import {
  listMyTrips,
  createTrip,
  listVehicles,
  listDrivers,
  type TripStatus,
} from "@/domains/transport";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/transport-company/trips/")({
  component: TripsIndexPage,
});
// Pure layout at /dashboard/transport-company/trips.tsx renders <Outlet /> — see that file's own
// note (same pattern as dashboard/breeder/litters.tsx): this file is the list
// (/dashboard/transport-company/trips), trips.$tripId.tsx is the detail
// (/dashboard/transport-company/trips/$tripId).

type FormValues = {
  name: string;
  departureDate: string;
  routeMapsUrl: string;
  vehicleId: string;
  driverId: string;
  notes: string;
};

const NONE = "__none__";

const STATUS_BADGE_VARIANT: Record<TripStatus, "default" | "secondary" | "destructive"> = {
  in_progress: "default",
  planning: "secondary",
  completed: "secondary",
  cancelled: "destructive",
};

function TripsIndexPage() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const companyQuery = useQuery({
    queryKey: ["my-transport-company", userId],
    enabled: !!userId,
    queryFn: () => getMyTransportCompany(userId!),
  });
  // RLS ("org members manage their own trips") already scopes this to the caller's own company —
  // see 20260915000000_transport_company_trips.sql.
  const tripsQuery = useQuery({ queryKey: ["my-trips"], queryFn: listMyTrips });
  const vehiclesQuery = useQuery({ queryKey: ["vehicles"], queryFn: listVehicles });
  const driversQuery = useQuery({ queryKey: ["drivers"], queryFn: listDrivers });

  const form = useForm<FormValues>({
    defaultValues: {
      name: "",
      departureDate: "",
      routeMapsUrl: "",
      vehicleId: NONE,
      driverId: NONE,
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createTrip({
        organization_id: companyQuery.data!.id,
        name: values.name,
        departure_date: values.departureDate || null,
        route_maps_url: values.routeMapsUrl || null,
        vehicle_id: values.vehicleId !== NONE ? values.vehicleId : null,
        driver_id: values.driverId !== NONE ? values.driverId : null,
        notes: values.notes || null,
        created_by: userId,
      }),
    onSuccess: () => {
      toast.success(t("transportCompanyPanel.trips.addedToast"));
      setOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["my-trips"] });
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("transportCompanyPanel.trips.saveFailed"))),
  });

  const trips = tripsQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];
  const drivers = driversQuery.data ?? [];

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium">
            {t("transportCompanyPanel.trips.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("transportCompanyPanel.trips.subtitle")}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!companyQuery.data?.id}>
              <Plus className="mr-1 size-4" /> {t("transportCompanyPanel.trips.addButton")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("transportCompanyPanel.trips.addButton")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-3">
              <div>
                <Label>{t("transportCompanyPanel.trips.fieldName")}</Label>
                <Input
                  placeholder={t("transportCompanyPanel.trips.fieldNamePlaceholder")}
                  {...form.register("name", { required: true })}
                />
              </div>
              <div>
                <Label>{t("transportCompanyPanel.trips.fieldDepartureDate")}</Label>
                <Input type="date" {...form.register("departureDate")} />
              </div>
              <div>
                <Label>{t("transportCompanyPanel.trips.fieldRouteMapsUrl")}</Label>
                <Input placeholder="https://maps.google.com/…" {...form.register("routeMapsUrl")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("transportCompanyPanel.trips.fieldVehicle")}</Label>
                  <Select
                    value={form.watch("vehicleId")}
                    onValueChange={(v) => form.setValue("vehicleId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>
                        {t("transportCompanyPanel.trips.fieldNone")}
                      </SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("transportCompanyPanel.trips.fieldDriver")}</Label>
                  <Select
                    value={form.watch("driverId")}
                    onValueChange={(v) => form.setValue("driverId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>
                        {t("transportCompanyPanel.trips.fieldNone")}
                      </SelectItem>
                      {drivers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>{t("transportCompanyPanel.trips.fieldNotes")}</Label>
                <Textarea rows={3} {...form.register("notes")} />
              </div>
              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {t("transportCompanyPanel.trips.addButton")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {tripsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("transportCompanyPanel.trips.loading")}</p>
      ) : !trips.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <MapPinned className="mx-auto mb-2 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t("transportCompanyPanel.trips.emptyBody")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <Link
              key={trip.id}
              to="/dashboard/transport-company/trips/$tripId"
              params={{ tripId: trip.id }}
              className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card p-5 transition-colors hover:bg-secondary/40"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-lg font-semibold">{trip.name}</h3>
                <Badge variant={STATUS_BADGE_VARIANT[trip.status]} className="capitalize">
                  {t(`transportCompanyPanel.trips.status.${trip.status}`)}
                </Badge>
              </div>
              {trip.departure_date && (
                <p className="text-sm text-muted-foreground">
                  {new Date(trip.departure_date).toLocaleDateString("en-GB")}
                </p>
              )}
              {trip.notes && (
                <p className="line-clamp-2 text-sm text-muted-foreground">{trip.notes}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
