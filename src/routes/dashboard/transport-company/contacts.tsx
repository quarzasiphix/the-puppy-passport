import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { useAuth } from "@/domains/identity";
import { getMyTransportCompany } from "@/domains/breeders";
import { createContact, deleteContact, listContacts } from "@/domains/transport";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/transport-company/contacts")({
  component: CompanyContactsPage,
});

type FormValues = {
  name: string;
  phone: string;
  email: string;
  roleLabel: string;
  city: string;
  country: string;
};

const EMPTY_FORM: FormValues = {
  name: "",
  phone: "",
  email: "",
  roleLabel: "",
  city: "",
  country: "",
};

function CompanyContactsPage() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const queryClient = useQueryClient();

  const companyQuery = useQuery({
    queryKey: ["my-transport-company", userId],
    enabled: !!userId,
    queryFn: () => getMyTransportCompany(userId!),
  });
  const companyId = companyQuery.data?.id ?? null;

  // Includes both this company's own contacts and the ops-wide shared address book (RLS: "company
  // members manage their own contacts" + "transport company members view shared contacts").
  const query = useQuery({
    queryKey: ["transport-contacts", companyId],
    enabled: !!companyId,
    queryFn: () => listContacts(companyId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createContact({
        organization_id: companyId,
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        role_label: form.roleLabel || null,
        city: form.city || null,
        country: form.country || null,
      }),
    onSuccess: () => {
      toast.success(t("transportCompanyPanel.contacts.addedToast"));
      setOpen(false);
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ["transport-contacts", companyId] });
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("transportCompanyPanel.contacts.saveFailed"))),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => {
      toast.success(t("transportCompanyPanel.contacts.removedToast"));
      queryClient.invalidateQueries({ queryKey: ["transport-contacts", companyId] });
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("transportCompanyPanel.contacts.removeFailed"))),
  });

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium">
            {t("transportCompanyPanel.contacts.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("transportCompanyPanel.contacts.subtitle")}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!companyId}>
              <Plus className="mr-1 size-4" /> {t("transportCompanyPanel.contacts.addButton")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("transportCompanyPanel.contacts.addButton")}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="space-y-3"
            >
              <div>
                <Label className="text-xs">{t("transportCompanyPanel.contacts.fieldName")}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">
                    {t("transportCompanyPanel.contacts.fieldPhone")}
                  </Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">
                    {t("transportCompanyPanel.contacts.fieldEmail")}
                  </Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t("transportCompanyPanel.contacts.fieldRole")}</Label>
                  <Input
                    placeholder={t("transportCompanyPanel.contacts.fieldRolePlaceholder")}
                    value={form.roleLabel}
                    onChange={(e) => setForm((f) => ({ ...f, roleLabel: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t("transportCompanyPanel.contacts.fieldCity")}</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">
                    {t("transportCompanyPanel.contacts.fieldCountry")}
                  </Label>
                  <Input
                    value={form.country}
                    onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {t("transportCompanyPanel.contacts.saveButton")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {query.data?.map((c) => (
          <div key={c.id} className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {[c.role_label, [c.city, c.country].filter(Boolean).join(", ")]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              {/* A shared, ops-wide contact (organization_id null) is read-only here — RLS
                  ("company members manage their own contacts") already blocks deleting one the
                  company doesn't own; the delete button is simply hidden for those. */}
              {c.organization_id && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(c.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
            {c.phone && (
              <a
                href={`tel:${c.phone}`}
                className="mt-2 flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Phone className="size-3.5" /> {c.phone}
              </a>
            )}
          </div>
        ))}
        {query.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("transportCompanyPanel.contacts.emptyBody")}
          </p>
        )}
      </div>
    </div>
  );
}
