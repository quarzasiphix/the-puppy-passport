import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookUser, Plus } from "lucide-react";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/command";
import { createContact, listContacts, type ContactRow } from "../services/contacts";

// Replaces a raw "Contact name" + "Contact phone" input pair on a stop, wherever one appears —
// pickup contact, dropoff contact, an extra contact row. Search an already-saved contact (an
// operator's or a transport company's own address book, see 20260925000000_transport_contacts.sql)
// to autofill both fields, or just type free text as before. When the typed name has no saved
// match, an inline "Save to contacts" action persists it for next time — this is the one place a
// new transport_contacts row gets created, so every save flows through the same small form
// regardless of which stop/page triggered it.
export function ContactPicker({
  organizationId,
  name,
  phone,
  onChange,
  onBlur,
  nameLabel = "Contact name",
  phoneLabel = "Contact phone",
}: {
  organizationId: string | null;
  name: string;
  phone: string;
  onChange: (fields: { name: string; phone: string }) => void;
  // Optional — lets a caller with its own autosave-on-blur convention (e.g. a stop's edit dialog)
  // hook into "the user is done editing this field" the same way a plain <Input onBlur> would.
  // Also fired immediately after picking a saved contact, since selecting one is just as much a
  // deliberate, complete edit as tabbing out of a typed field.
  onBlur?: (fields: { name: string; phone: string }) => void;
  nameLabel?: string;
  phoneLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [roleLabel, setRoleLabel] = useState("");
  const queryClient = useQueryClient();

  const contactsQuery = useQuery({
    queryKey: ["transport-contacts", organizationId],
    queryFn: () => listContacts(organizationId),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      createContact({
        organization_id: organizationId,
        name,
        phone: phone || null,
        role_label: roleLabel || null,
      }),
    onSuccess: () => {
      toast.success(`Saved "${name}" to contacts.`);
      setSaveOpen(false);
      setRoleLabel("");
      queryClient.invalidateQueries({ queryKey: ["transport-contacts", organizationId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save contact."),
  });

  const selectContact = (contact: ContactRow) => {
    const fields = { name: contact.name, phone: contact.phone ?? "" };
    onChange(fields);
    onBlur?.(fields);
    setOpen(false);
  };

  const exactMatch = contactsQuery.data?.some(
    (c) => c.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );

  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">{nameLabel}</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button type="button" size="sm" variant="ghost" className="h-5 px-1">
                <BookUser className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
              <Command>
                <CommandInput placeholder="Search saved contacts…" />
                <CommandList>
                  <CommandEmpty>No saved contacts yet.</CommandEmpty>
                  <CommandGroup>
                    {contactsQuery.data?.map((c) => (
                      <CommandItem key={c.id} value={c.name} onSelect={() => selectContact(c)}>
                        <div>
                          <div>{c.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {[c.role_label, c.phone].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <Input
          value={name}
          onChange={(e) => onChange({ name: e.target.value, phone })}
          onBlur={() => onBlur?.({ name, phone })}
        />
      </div>
      <div>
        <Label className="text-xs">{phoneLabel}</Label>
        <Input
          value={phone}
          onChange={(e) => onChange({ name, phone: e.target.value })}
          onBlur={() => onBlur?.({ name, phone })}
        />
      </div>

      {name.trim() && !exactMatch && (
        <div className="col-span-2">
          {saveOpen ? (
            <div className="flex items-center gap-2 rounded-lg bg-secondary/40 p-2">
              <Input
                placeholder="Role (e.g. Breeder)"
                value={roleLabel}
                onChange={(e) => setRoleLabel(e.target.value)}
                className="h-8"
              />
              <Button
                type="button"
                size="sm"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSaveOpen(true)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="size-3" /> Save "{name}" to contacts
            </button>
          )}
        </div>
      )}
    </div>
  );
}
