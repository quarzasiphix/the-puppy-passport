import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, Plus, UserCheck } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { useAuth } from "@/domains/identity";
import { getMyTransportCompany } from "@/domains/breeders";
import { createDriver, listDrivers, resolveProfileIdByEmail } from "@/domains/transport";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/transport-company/drivers")({
  component: DriversPage,
});

type FormValues = { name: string; contact: string; loginEmail: string };

function DriversPage() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const companyQuery = useQuery({
    queryKey: ["my-transport-company", userId],
    enabled: !!userId,
    queryFn: () => getMyTransportCompany(userId!),
  });
  // RLS ("company members manage their own drivers") already scopes this to the caller's own
  // company — see 20260912150000_fleet_multi_tenancy.sql. These are the company's own operational
  // driver records, distinct from an org_members "driver"-role staff invite on the Team page.
  const query = useQuery({ queryKey: ["drivers"], queryFn: listDrivers });

  const form = useForm<FormValues>({ defaultValues: { name: "", contact: "", loginEmail: "" } });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) =>
      createDriver({
        organization_id: companyQuery.data!.id,
        name: values.name,
        contact: values.contact || null,
        login_email: values.loginEmail || null,
        profile_id: await resolveProfileIdByEmail(values.loginEmail),
      }),
    onSuccess: () => {
      toast.success(t("transportCompanyPanel.drivers.addedToast"));
      setOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("transportCompanyPanel.drivers.saveFailed"))),
  });

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium">
            {t("transportCompanyPanel.drivers.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("transportCompanyPanel.drivers.subtitle")}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!companyQuery.data?.id}>
              <Plus className="mr-1 size-4" /> {t("transportCompanyPanel.drivers.addButton")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("transportCompanyPanel.drivers.addButton")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-3">
              <div>
                <Label>{t("transportCompanyPanel.drivers.colName")}</Label>
                <Input {...form.register("name", { required: true })} />
              </div>
              <div>
                <Label>Contact</Label>
                <Input {...form.register("contact")} placeholder="Phone or email" />
              </div>
              <div>
                <Label>{t("transportCompanyPanel.drivers.fieldLoginEmail")}</Label>
                <Input
                  type="email"
                  {...form.register("loginEmail")}
                  placeholder="driver@example.com"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("transportCompanyPanel.drivers.fieldLoginEmailHelp")}
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {t("transportCompanyPanel.drivers.addButton")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("transportCompanyPanel.drivers.loading")}
        </p>
      ) : !query.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t("transportCompanyPanel.drivers.emptyBody")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-4">{t("transportCompanyPanel.drivers.colName")}</th>
                  <th className="p-4">{t("transportCompanyPanel.drivers.colStatus")}</th>
                  <th className="p-4">{t("transportCompanyPanel.drivers.colQualification")}</th>
                  <th className="p-4">{t("transportCompanyPanel.drivers.colAccount")}</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {query.data.map((d) => (
                  <tr
                    key={d.id}
                    className="cursor-pointer hover:bg-secondary/40"
                    onClick={() =>
                      navigate({
                        to: "/dashboard/transport-company/drivers/$id",
                        params: { id: d.id },
                      })
                    }
                  >
                    <td className="p-4 font-medium">{d.name}</td>
                    <td className="p-4">
                      <Badge variant="secondary" className="capitalize">
                        {d.availability_status ?? "—"}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground capitalize">
                      {d.qualification_status}
                    </td>
                    <td className="p-4">
                      {d.profile_id ? (
                        <span className="flex items-center gap-1 text-xs text-success">
                          <UserCheck className="size-3.5" />{" "}
                          {t("transportCompanyPanel.drivers.linkedBadge")}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t("transportCompanyPanel.drivers.unlinkedBadge")}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
