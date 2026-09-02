import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/shared/ui/form";
import { createVehicle, expiryWarnings, listVehicles } from "@/domains/transport";

export const Route = createFileRoute("/dashboard/operations/vehicles")({
  component: VehiclesPage,
});

type FormValues = {
  name: string;
  registrationNumber: string;
  vehicleType: string;
  make: string;
  model: string;
  year: string;
  insuranceExpiryDate: string;
  nextServiceDate: string;
};

function VehiclesPage() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["vehicles"], queryFn: listVehicles });
  const form = useForm<FormValues>({
    defaultValues: {
      name: "",
      registrationNumber: "",
      vehicleType: "van",
      make: "",
      model: "",
      year: "",
      insuranceExpiryDate: "",
      nextServiceDate: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createVehicle({
        name: values.name,
        registration_number: values.registrationNumber || null,
        vehicle_type: values.vehicleType || null,
        make: values.make || null,
        model: values.model || null,
        year: values.year ? Number(values.year) : null,
        insurance_expiry_date: values.insuranceExpiryDate || null,
        next_service_date: values.nextServiceDate || null,
      }),
    onSuccess: () => {
      toast.success("Vehicle added.");
      setOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add vehicle."),
  });

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium">Vehicles</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 size-4" /> Add vehicle
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add vehicle</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
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
                </div>
                <Button type="submit" disabled={mutation.isPending}>
                  Add vehicle
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {query.data?.map((v) => {
          const warnings = [
            ...expiryWarnings(v.insurance_expiry_date, "Insurance"),
            ...expiryWarnings(v.document_expiry_date, "Document"),
            ...expiryWarnings(v.next_service_date, "Service"),
          ];
          return (
            <div key={v.id} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-lg font-semibold">{v.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {[v.make, v.model, v.year].filter(Boolean).join(" ") || v.vehicle_type} ·{" "}
                    {v.registration_number ?? "no plate on file"}
                  </div>
                </div>
                <Badge variant={v.active ? "secondary" : "destructive"}>
                  {v.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              {warnings.length > 0 && (
                <div className="mt-3 space-y-1">
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
            </div>
          );
        })}
        {query.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No vehicles yet.</p>
        )}
      </div>
    </div>
  );
}
