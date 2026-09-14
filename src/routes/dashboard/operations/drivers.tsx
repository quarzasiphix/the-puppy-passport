import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Plus, UserCheck } from "lucide-react";
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
import { createDriver, expiryWarnings, linkDriverAccount, listDrivers } from "@/domains/transport";

export const Route = createFileRoute("/dashboard/operations/drivers")({
  component: DriversPage,
});

type FormValues = {
  name: string;
  contact: string;
  homeRegion: string;
  documentExpiryDate: string;
  loginEmail: string;
};

function DriversPage() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["drivers"], queryFn: listDrivers });
  const form = useForm<FormValues>({
    defaultValues: {
      name: "",
      contact: "",
      homeRegion: "",
      documentExpiryDate: "",
      loginEmail: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const id = await createDriver({
        name: values.name,
        contact: values.contact || null,
        home_region: values.homeRegion || null,
        document_expiry_date: values.documentExpiryDate || null,
      });
      if (values.loginEmail) await linkDriverAccount(id, values.loginEmail);
    },
    onSuccess: () => {
      toast.success("Driver added.");
      setOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add driver."),
  });

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium">Drivers</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 size-4" /> Add driver
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add driver</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-3">
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
                  name="loginEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Anemalo account email (optional)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="driver@example.com" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        If they already have an Anemalo account, this links it so they can see their
                        own jobs at /dashboard/driver.
                      </p>
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={mutation.isPending}>
                  Add driver
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {query.data?.map((d) => {
          const warnings = expiryWarnings(d.document_expiry_date, "Qualification document");
          return (
            <Link
              key={d.id}
              to="/dashboard/operations/drivers/$id"
              params={{ id: d.id }}
              className="block rounded-2xl border border-border/70 bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-lg font-semibold">{d.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {d.home_region ?? "No region on file"}
                  </div>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {d.internal_verification_status.replace(/_/g, " ")}
                </Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground capitalize">
                Availability: {d.availability_status ?? "unknown"}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs">
                {d.profile_id ? (
                  <span className="flex items-center gap-1 text-success">
                    <UserCheck className="size-3.5" /> Linked to an account
                  </span>
                ) : d.login_email ? (
                  <span className="text-muted-foreground">
                    Waiting for {d.login_email} to sign up
                  </span>
                ) : (
                  <span className="text-muted-foreground">No account linked</span>
                )}
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
            </Link>
          );
        })}
        {query.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No drivers yet.</p>
        )}
      </div>
    </div>
  );
}
