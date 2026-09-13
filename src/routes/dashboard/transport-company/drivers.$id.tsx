import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, UserCheck } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Badge } from "@/shared/ui/badge";
import {
  expiryWarnings,
  getDriver,
  resolveProfileIdByEmail,
  updateDriver,
} from "@/domains/transport";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/transport-company/drivers/$id")({
  component: CompanyDriverDetail,
});

type FormValues = {
  name: string;
  contact: string;
  homeRegion: string;
  availabilityStatus: string;
  qualificationStatus: string;
  documentExpiryDate: string;
  emergencyContact: string;
  internalNotes: string;
  loginEmail: string;
};

function CompanyDriverDetail() {
  const { t } = useTranslation();
  const { id } = useParams({ from: "/dashboard/transport-company/drivers/$id" });
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ["driver", id], queryFn: () => getDriver(id) });
  const driver = query.data;

  const form = useForm<FormValues>({
    values: driver
      ? {
          name: driver.name,
          contact: driver.contact ?? "",
          homeRegion: driver.home_region ?? "",
          availabilityStatus: driver.availability_status ?? "",
          qualificationStatus: driver.qualification_status ?? "",
          documentExpiryDate: driver.document_expiry_date ?? "",
          emergencyContact: driver.emergency_contact ?? "",
          internalNotes: driver.internal_notes ?? "",
          loginEmail: driver.login_email ?? "",
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) =>
      updateDriver(id, {
        name: values.name,
        contact: values.contact || null,
        home_region: values.homeRegion || null,
        availability_status: values.availabilityStatus || null,
        qualification_status: values.qualificationStatus || "unverified",
        document_expiry_date: values.documentExpiryDate || null,
        emergency_contact: values.emergencyContact || null,
        internal_notes: values.internalNotes || null,
        login_email: values.loginEmail || null,
        profile_id: await resolveProfileIdByEmail(values.loginEmail),
      }),
    onSuccess: () => {
      toast.success(t("transportCompanyPanel.drivers.updatedToast"));
      queryClient.invalidateQueries({ queryKey: ["driver", id] });
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("transportCompanyPanel.drivers.saveFailed"))),
  });

  if (query.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">{t("transportCompanyPanel.drivers.loading")}</p>
    );
  }
  if (!driver) return <p className="text-sm text-destructive">Not found.</p>;

  const warnings = expiryWarnings(driver.document_expiry_date, "Document");

  return (
    <div>
      <Link
        to="/dashboard/transport-company/drivers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {t("transportCompanyPanel.drivers.detailBack")}
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-display text-2xl font-medium">{driver.name}</h1>
        <Badge variant="secondary" className="capitalize">
          {driver.qualification_status}
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

      <div className="mb-6 flex items-center gap-1.5 text-sm">
        {driver.profile_id ? (
          <span className="flex items-center gap-1.5 text-success">
            <UserCheck className="size-4" /> {t("transportCompanyPanel.drivers.linkedNote")}
          </span>
        ) : driver.login_email ? (
          <span className="text-muted-foreground">
            {t("transportCompanyPanel.drivers.waitingForSignupNotePrefix")} {driver.login_email}
          </span>
        ) : (
          <span className="text-muted-foreground">
            {t("transportCompanyPanel.drivers.unlinkedNote")}
          </span>
        )}
      </div>

      <section className="rounded-2xl border border-border/70 bg-card p-5">
        <form
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <div>
            <Label>{t("transportCompanyPanel.drivers.colName")}</Label>
            <Input {...form.register("name", { required: true })} />
          </div>
          <div>
            <Label>{t("transportCompanyPanel.drivers.fieldContact")}</Label>
            <Input {...form.register("contact")} placeholder="Phone or email" />
          </div>
          <div>
            <Label>{t("transportCompanyPanel.drivers.fieldHomeRegion")}</Label>
            <Input {...form.register("homeRegion")} />
          </div>
          <div>
            <Label>{t("transportCompanyPanel.drivers.colStatus")}</Label>
            <Input {...form.register("availabilityStatus")} placeholder="available, unavailable…" />
          </div>
          <div>
            <Label>{t("transportCompanyPanel.drivers.colQualification")}</Label>
            <Input {...form.register("qualificationStatus")} />
          </div>
          <div>
            <Label>{t("transportCompanyPanel.drivers.fieldDocumentExpiry")}</Label>
            <Input type="date" {...form.register("documentExpiryDate")} />
          </div>
          <div>
            <Label>{t("transportCompanyPanel.drivers.fieldEmergencyContact")}</Label>
            <Input {...form.register("emergencyContact")} />
          </div>
          <div>
            <Label>{t("transportCompanyPanel.drivers.fieldLoginEmail")}</Label>
            <Input type="email" {...form.register("loginEmail")} placeholder="driver@example.com" />
          </div>
          <div className="sm:col-span-2">
            <Label>{t("transportCompanyPanel.drivers.fieldNotes")}</Label>
            <Textarea rows={3} {...form.register("internalNotes")} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={mutation.isPending}>
              {t("transportCompanyPanel.drivers.saveButton")}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
