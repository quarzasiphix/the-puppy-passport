import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ChevronLeft, UserCheck } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/shared/ui/form";
import {
  expiryWarnings,
  getDriver,
  resolveProfileIdByEmail,
  updateDriver,
} from "@/domains/transport";
import type { Database } from "@/lib/supabase/types";

export const Route = createFileRoute("/dashboard/operations/drivers/$id")({
  component: OpsDriverDetail,
});

type VerificationStatus = Database["public"]["Enums"]["driver_verification_status"];

type FormValues = {
  name: string;
  contact: string;
  homeRegion: string;
  availabilityStatus: string;
  qualificationStatus: string;
  documentExpiryDate: string;
  emergencyContact: string;
  internalVerificationStatus: VerificationStatus;
  internalNotes: string;
  loginEmail: string;
};

function OpsDriverDetail() {
  const { id } = useParams({ from: "/dashboard/operations/drivers/$id" });
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
          internalVerificationStatus: driver.internal_verification_status,
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
        internal_verification_status: values.internalVerificationStatus,
        internal_notes: values.internalNotes || null,
        login_email: values.loginEmail || null,
        profile_id: await resolveProfileIdByEmail(values.loginEmail),
      }),
    onSuccess: () => {
      toast.success("Driver updated.");
      queryClient.invalidateQueries({ queryKey: ["driver", id] });
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save driver."),
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!driver) return <p className="text-sm text-destructive">Driver not found.</p>;

  const warnings = expiryWarnings(driver.document_expiry_date, "Qualification document");

  return (
    <div>
      <Link
        to="/dashboard/operations/drivers"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> All drivers
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium">{driver.name}</h1>
          <p className="text-sm text-muted-foreground">
            {driver.home_region ?? "No region on file"}
          </p>
        </div>
        <Badge variant="secondary" className="capitalize">
          {driver.internal_verification_status.replace(/_/g, " ")}
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
            <UserCheck className="size-4" /> Linked to an Anemalo account — can sign in and see
            their own jobs.
          </span>
        ) : driver.login_email ? (
          <span className="text-muted-foreground">
            Waiting for {driver.login_email} to sign up — will link automatically once they do.
          </span>
        ) : (
          <span className="text-muted-foreground">
            No account linked — add their email below to give them access to /dashboard/driver.
          </span>
        )}
      </div>

      <section className="rounded-2xl border border-border/70 bg-card p-5">
        <h3 className="mb-3 font-display text-base font-semibold">Driver record</h3>
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
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact (private — never public)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="homeRegion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Home region</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="availabilityStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Availability</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="available, unavailable, on_leave…" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="qualificationStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Qualification status (shown to the company)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="documentExpiryDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Qualification document expiry</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emergencyContact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency contact</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="internalVerificationStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal verification status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unverified">Unverified</SelectItem>
                      <SelectItem value="documents_submitted">Documents submitted</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="loginEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Anemalo account email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="driver@example.com" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="internalNotes"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Internal notes (never shown to the driver or company)</FormLabel>
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
