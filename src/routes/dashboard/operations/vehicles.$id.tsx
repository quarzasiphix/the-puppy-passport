import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Switch } from "@/shared/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/shared/ui/form";
import { expiryWarnings, getVehicle, updateVehicle } from "@/domains/transport";

export const Route = createFileRoute("/dashboard/operations/vehicles/$id")({
  component: OpsVehicleDetail,
});

type FormValues = {
  name: string;
  registrationNumber: string;
  vehicleType: string;
  make: string;
  model: string;
  year: string;
  countryOfRegistration: string;
  active: boolean;
  insuranceExpiryDate: string;
  nextServiceDate: string;
  lastServiceDate: string;
  lastCleaningDate: string;
  cleaningStatus: string;
  ventilationInfo: string;
  temperatureMonitoring: boolean;
  cameraAvailable: boolean;
  authorisationNotes: string;
  internalNotes: string;
};

function OpsVehicleDetail() {
  const { id } = useParams({ from: "/dashboard/operations/vehicles/$id" });
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ["vehicle", id], queryFn: () => getVehicle(id) });
  const vehicle = query.data;

  const form = useForm<FormValues>({
    values: vehicle
      ? {
          name: vehicle.name,
          registrationNumber: vehicle.registration_number ?? "",
          vehicleType: vehicle.vehicle_type ?? "",
          make: vehicle.make ?? "",
          model: vehicle.model ?? "",
          year: vehicle.year ? String(vehicle.year) : "",
          countryOfRegistration: vehicle.country_of_registration ?? "",
          active: vehicle.active,
          insuranceExpiryDate: vehicle.insurance_expiry_date ?? "",
          nextServiceDate: vehicle.next_service_date ?? "",
          lastServiceDate: vehicle.last_service_date ?? "",
          lastCleaningDate: vehicle.last_cleaning_date ?? "",
          cleaningStatus: vehicle.cleaning_status ?? "",
          ventilationInfo: vehicle.ventilation_info ?? "",
          temperatureMonitoring: vehicle.temperature_monitoring,
          cameraAvailable: vehicle.camera_available,
          authorisationNotes: vehicle.authorisation_notes ?? "",
          internalNotes: vehicle.internal_notes ?? "",
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      updateVehicle(id, {
        name: values.name,
        registration_number: values.registrationNumber || null,
        vehicle_type: values.vehicleType || null,
        make: values.make || null,
        model: values.model || null,
        year: values.year ? Number(values.year) : null,
        country_of_registration: values.countryOfRegistration || null,
        active: values.active,
        insurance_expiry_date: values.insuranceExpiryDate || null,
        next_service_date: values.nextServiceDate || null,
        last_service_date: values.lastServiceDate || null,
        last_cleaning_date: values.lastCleaningDate || null,
        cleaning_status: values.cleaningStatus || null,
        ventilation_info: values.ventilationInfo || null,
        temperature_monitoring: values.temperatureMonitoring,
        camera_available: values.cameraAvailable,
        authorisation_notes: values.authorisationNotes || null,
        internal_notes: values.internalNotes || null,
      }),
    onSuccess: () => {
      toast.success("Vehicle updated.");
      queryClient.invalidateQueries({ queryKey: ["vehicle", id] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save vehicle."),
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!vehicle) return <p className="text-sm text-destructive">Vehicle not found.</p>;

  const warnings = [
    ...expiryWarnings(vehicle.insurance_expiry_date, "Insurance"),
    ...expiryWarnings(vehicle.document_expiry_date, "Document"),
    ...expiryWarnings(vehicle.next_service_date, "Service"),
  ];

  return (
    <div>
      <Link
        to="/dashboard/operations/vehicles"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> All vehicles
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium">{vehicle.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ") ||
              vehicle.vehicle_type}{" "}
            · {vehicle.registration_number ?? "no plate on file"}
          </p>
        </div>
        <Badge variant={vehicle.active ? "secondary" : "destructive"}>
          {vehicle.active ? "Active" : "Inactive"}
        </Badge>
      </header>

      {warnings.length > 0 && (
        <div className="mb-6 space-y-1">
          {warnings.map((w) => (
            <div
              key={w.label}
              className={`flex items-center gap-1.5 text-xs ${w.severity === "expired" ? "text-destructive" : "text-warning"}`}
            >
              <AlertTriangle className="size-3.5" /> {w.label}
            </div>
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-border/70 bg-card p-5">
        <h3 className="mb-3 font-display text-base font-semibold">Vehicle record</h3>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="registrationNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registration number</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="make"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Make</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Year</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vehicleType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="countryOfRegistration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country of registration</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="insuranceExpiryDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Insurance expiry</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastServiceDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last service</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nextServiceDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Next service due</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastCleaningDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last cleaning</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cleaningStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cleaning status</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ventilationInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ventilation info</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="temperatureMonitoring"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                  <FormLabel className="mb-0">Temperature monitoring fitted</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cameraAvailable"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                  <FormLabel className="mb-0">Camera available</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                  <FormLabel className="mb-0">Active (eligible for assignment)</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="authorisationNotes"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Authorisation notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="internalNotes"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Internal notes (never shown to the company)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="md:col-span-2">
              <Button type="submit" disabled={mutation.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </Form>
      </section>
    </div>
  );
}
