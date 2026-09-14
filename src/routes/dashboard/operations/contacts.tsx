import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
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
import { createContact, deleteContact, listContacts } from "@/domains/transport";

export const Route = createFileRoute("/dashboard/operations/contacts")({
  component: OpsContactsPage,
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

function OpsContactsPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const queryClient = useQueryClient();

  // organizationId=null -> ops's own shared address book (see 20260925000000_transport_contacts.sql).
  const query = useQuery({
    queryKey: ["transport-contacts", null],
    queryFn: () => listContacts(null),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createContact({
        organization_id: null,
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        role_label: form.roleLabel || null,
        city: form.city || null,
        country: form.country || null,
      }),
    onSuccess: () => {
      toast.success("Contact saved.");
      setOpen(false);
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ["transport-contacts", null] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save contact."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => {
      toast.success("Contact removed.");
      queryClient.invalidateQueries({ queryKey: ["transport-contacts", null] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not remove contact."),
  });

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium">Saved contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared across all ops staff — breeders, foundations and private individuals you come
            back to when planning routes and trips.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 size-4" /> Add contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add contact</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="space-y-3"
            >
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Role</Label>
                  <Input
                    placeholder="Breeder, Foundation…"
                    value={form.roleLabel}
                    onChange={(e) => setForm((f) => ({ ...f, roleLabel: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">City</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Country</Label>
                  <Input
                    value={form.country}
                    onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                Save contact
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
              <div className="flex items-center gap-1">
                {c.linked_organisation_id && <Badge variant="secondary">Registered breeder</Badge>}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(c.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
            {c.phone && (
              <a
                href={`tel:${c.phone}`}
                className="mt-2 flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Phone className="size-3.5" /> {c.phone}
              </a>
            )}
            {c.notes && <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>}
          </div>
        ))}
        {query.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No saved contacts yet.</p>
        )}
      </div>
    </div>
  );
}
