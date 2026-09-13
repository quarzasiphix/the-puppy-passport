import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Switch } from "@/shared/ui/switch";
import { expiryWarnings, getVehicle, updateVehicle } from "@/domains/transport";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/transport-company/vehicles/$id")({
  component: CompanyVehicleDetail,
});

type FormValues = {
  name: string;
  registrationNumber: string;
  vehicleType: string;
  make: string;
  model: string;
  year: string;
  active: boolean;
  insuranceExpiryDate: string;
  nextServiceDate: string;
};

function CompanyVehicleDetail() {
  const { t } = useTranslation();
  const { id } = useParams({ from: "/dashboard/transport-company/vehicles/$id" });
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
          active: vehicle.active,
          insuranceExpiryDate: vehicle.insurance_expiry_date ?? "",
          nextServiceDate: vehicle.next_service_date ?? "",
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
        active: values.active,
        insurance_expiry_date: values.insuranceExpiryDate || null,
        next_service_date: values.nextServiceDate || null,
      }),
    onSuccess: () => {
      toast.success(t("transportCompanyPanel.vehicles.updatedToast"));
      queryClient.invalidateQueries({ queryKey: ["vehicle", id] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("transportCompanyPanel.vehicles.saveFailed"))),
  });

  if (query.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">{t("transportCompanyPanel.vehicles.loading")}</p>
    );
  }
  if (!vehicle) return <p className="text-sm text-destructive">Not found.</p>;

  const warnings = [
    ...expiryWarnings(vehicle.insurance_expiry_date, "Insurance"),
    ...expiryWarnings(vehicle.next_service_date, "Service"),
  ];

  return (
    <div>
      <Link
        to="/dashboard/transport-company/vehicles"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {t("transportCompanyPanel.vehicles.detailBack")}
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-display text-2xl font-medium">{vehicle.name}</h1>
        <Badge variant={vehicle.active ? "secondary" : "destructive"}>
          {vehicle.active
            ? t("transportCompanyPanel.vehicles.activeBadge")
            : t("transportCompanyPanel.vehicles.inactiveBadge")}
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
        <form
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <div>
            <Label>{t("transportCompanyPanel.vehicles.colName")}</Label>
            <Input {...form.register("name", { required: true })} />
          </div>
          <div>
            <Label>{t("transportCompanyPanel.vehicles.colRegistration")}</Label>
            <Input {...form.register("registrationNumber")} />
          </div>
          <div>
            <Label>{t("transportCompanyPanel.vehicles.fieldMake")}</Label>
            <Input {...form.register("make")} />
          </div>
          <div>
            <Label>{t("transportCompanyPanel.vehicles.fieldModel")}</Label>
            <Input {...form.register("model")} />
          </div>
          <div>
            <Label>{t("transportCompanyPanel.vehicles.fieldYear")}</Label>
            <Input type="number" {...form.register("year")} />
          </div>
          <div>
            <Label>{t("transportCompanyPanel.vehicles.colType")}</Label>
            <Input {...form.register("vehicleType")} />
          </div>
          <div>
            <Label>{t("transportCompanyPanel.vehicles.fieldInsuranceExpiry")}</Label>
            <Input type="date" {...form.register("insuranceExpiryDate")} />
          </div>
          <div>
            <Label>{t("transportCompanyPanel.vehicles.fieldNextService")}</Label>
            <Input type="date" {...form.register("nextServiceDate")} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 sm:col-span-2">
            <Label className="mb-0">{t("transportCompanyPanel.vehicles.activeBadge")}</Label>
            <Switch
              checked={form.watch("active")}
              onCheckedChange={(checked) => form.setValue("active", checked)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={mutation.isPending}>
              {t("transportCompanyPanel.vehicles.saveButton")}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
