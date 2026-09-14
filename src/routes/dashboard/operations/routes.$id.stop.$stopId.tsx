import { useEffect, useState, type ChangeEvent } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Camera, MapPin, Pencil, Phone, ScanLine, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import {
  getRouteStop,
  updateRouteStop,
  listRouteStopContacts,
  addRouteStopContact,
  removeRouteStopContact,
  listRouteStopPhotos,
  getRouteStopPhotoUrl,
  uploadRouteStopPhoto,
  removeRouteStopPhoto,
  recognizeTransportedMicrochip,
  type RouteStopRow,
  type RouteStopContactRow,
  type RouteStopPhotoRow,
  type RecognizeMicrochipResult,
} from "@/domains/transport";
import { useAuth } from "@/domains/identity";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { buildMapsSearchUrl, parseAddressFromMapsUrl } from "@/lib/maps";

// A "neat view" of one stop — the read-focused counterpart to the edit Dialog already on
// routes.$id.index.tsx (which stays exactly as it was: reorder/edit/remove). This page is a new,
// additional way to open a stop, not a replacement: click Maps/phone links, glance at photos, and
// correct a detail inline via each section's "Edit" toggle — never a stacked-labels form by
// default. Visual pattern ported from trips.$tripId.tsx's StopDetailDialog (built for the
// company-facing Trips feature) onto a real page instead of a dialog.
export const Route = createFileRoute("/dashboard/operations/routes/$id/stop/$stopId")({
  component: RouteStopDetailPage,
});

function RouteStopDetailPage() {
  const { id, stopId } = useParams({
    from: "/dashboard/operations/routes/$id/stop/$stopId",
  });
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const stopQuery = useQuery({
    queryKey: ["route-stop", stopId],
    queryFn: () => getRouteStop(stopId),
  });
  const invalidateStop = () => queryClient.invalidateQueries({ queryKey: ["route-stop", stopId] });

  const stop = stopQuery.data;

  if (stopQuery.isLoading || !stop) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return <StopDetail id={id} stop={stop} userId={userId} onStopChanged={invalidateStop} />;
}

function StopDetail({
  id,
  stop,
  userId,
  onStopChanged,
}: {
  id: string;
  stop: RouteStopRow;
  userId: string | null;
  onStopChanged: () => void;
}) {
  const queryClient = useQueryClient();

  const [fields, setFields] = useState({
    pickup_maps_url: stop.pickup_maps_url ?? "",
    pickup_address_text: stop.pickup_address_text ?? "",
    pickup_contact_name: stop.pickup_contact_name ?? "",
    pickup_contact_phone: stop.pickup_contact_phone ?? "",
    pickup_notes: stop.pickup_notes ?? "",
    dropoff_maps_url: stop.dropoff_maps_url ?? "",
    dropoff_address_text: stop.dropoff_address_text ?? "",
    dropoff_contact_name: stop.dropoff_contact_name ?? "",
    dropoff_contact_phone: stop.dropoff_contact_phone ?? "",
    dropoff_notes: stop.dropoff_notes ?? "",
    microchip_number: stop.microchip_number ?? "",
  });
  const [editingPickup, setEditingPickup] = useState(false);
  const [editingDropoff, setEditingDropoff] = useState(false);

  useEffect(() => {
    setFields({
      pickup_maps_url: stop.pickup_maps_url ?? "",
      pickup_address_text: stop.pickup_address_text ?? "",
      pickup_contact_name: stop.pickup_contact_name ?? "",
      pickup_contact_phone: stop.pickup_contact_phone ?? "",
      pickup_notes: stop.pickup_notes ?? "",
      dropoff_maps_url: stop.dropoff_maps_url ?? "",
      dropoff_address_text: stop.dropoff_address_text ?? "",
      dropoff_contact_name: stop.dropoff_contact_name ?? "",
      dropoff_contact_phone: stop.dropoff_contact_phone ?? "",
      dropoff_notes: stop.dropoff_notes ?? "",
      microchip_number: stop.microchip_number ?? "",
    });
  }, [stop]);

  const saveMutation = useMutation({
    mutationFn: (patch: Partial<typeof fields>) => updateRouteStop(stop.id, patch),
    onSuccess: onStopChanged,
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not update this stop.")),
  });

  const field = (key: keyof typeof fields) => ({
    value: fields[key],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFields((f) => ({ ...f, [key]: e.target.value })),
    onBlur: () => {
      if (fields[key] !== (stop[key] ?? "")) saveMutation.mutate({ [key]: fields[key] || null });
    },
  });

  // Same as field(), but wires the address<->Maps-link auto-fill both ways — see the identical
  // pair in trips.$tripId.tsx's StopDetailDialog for the full reasoning.
  const addressField = (addressKey: "pickup_address_text" | "dropoff_address_text") => {
    const mapsKey = addressKey === "pickup_address_text" ? "pickup_maps_url" : "dropoff_maps_url";
    return {
      value: fields[addressKey],
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setFields((f) => ({ ...f, [addressKey]: e.target.value })),
      onBlur: () => {
        const patch: Partial<typeof fields> = {};
        if (fields[addressKey] !== (stop[addressKey] ?? "")) patch[addressKey] = fields[addressKey];
        if (fields[addressKey].trim() && !fields[mapsKey].trim()) {
          const generated = buildMapsSearchUrl(fields[addressKey]);
          patch[mapsKey] = generated;
          setFields((f) => ({ ...f, [mapsKey]: generated }));
        }
        if (Object.keys(patch).length) {
          saveMutation.mutate(
            Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v || null])),
          );
        }
      },
    };
  };

  const mapsUrlField = (mapsKey: "pickup_maps_url" | "dropoff_maps_url") => {
    const addressKey =
      mapsKey === "pickup_maps_url" ? "pickup_address_text" : "dropoff_address_text";
    return {
      value: fields[mapsKey],
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setFields((f) => ({ ...f, [mapsKey]: e.target.value })),
      onBlur: () => {
        const patch: Partial<typeof fields> = {};
        if (fields[mapsKey] !== (stop[mapsKey] ?? "")) patch[mapsKey] = fields[mapsKey];
        if (fields[mapsKey].trim() && !fields[addressKey].trim()) {
          const parsed = parseAddressFromMapsUrl(fields[mapsKey]);
          if (parsed) {
            patch[addressKey] = parsed;
            setFields((f) => ({ ...f, [addressKey]: parsed }));
          }
        }
        if (Object.keys(patch).length) {
          saveMutation.mutate(
            Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v || null])),
          );
        }
      },
    };
  };

  // Debounced "instant recognition" — same pattern as trips.$tripId.tsx.
  const [recognition, setRecognition] = useState<RecognizeMicrochipResult | null>(null);
  const recognizeMutation = useMutation({
    mutationFn: recognizeTransportedMicrochip,
    onSuccess: (result) => setRecognition(result && result.times_transported > 0 ? result : null),
  });
  useEffect(() => {
    const trimmed = fields.microchip_number.trim();
    if (!trimmed) {
      setRecognition(null);
      return;
    }
    const timeout = setTimeout(() => recognizeMutation.mutate(trimmed), 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires on the field value only
  }, [fields.microchip_number]);

  const contactsQuery = useQuery({
    queryKey: ["route-stop-contacts", stop.id],
    queryFn: () => listRouteStopContacts(stop.id),
  });
  const invalidateContacts = () =>
    queryClient.invalidateQueries({ queryKey: ["route-stop-contacts", stop.id] });
  const [contactForm, setContactForm] = useState({
    role_label: "",
    contact_name: "",
    contact_phone: "",
  });
  const addContactMutation = useMutation({
    mutationFn: () =>
      addRouteStopContact(stop.id, {
        role_label: contactForm.role_label || null,
        contact_name: contactForm.contact_name,
        contact_phone: contactForm.contact_phone || null,
      }),
    onSuccess: () => {
      setContactForm({ role_label: "", contact_name: "", contact_phone: "" });
      invalidateContacts();
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not add this contact.")),
  });
  const removeContactMutation = useMutation({
    mutationFn: removeRouteStopContact,
    onSuccess: invalidateContacts,
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not remove this contact.")),
  });

  const photosQuery = useQuery({
    queryKey: ["route-stop-photos", stop.id],
    queryFn: () => listRouteStopPhotos(stop.id),
  });
  const invalidatePhotos = () =>
    queryClient.invalidateQueries({ queryKey: ["route-stop-photos", stop.id] });
  const uploadPhotoMutation = useMutation({
    mutationFn: (file: File) => uploadRouteStopPhoto(stop.id, file, userId!),
    onSuccess: invalidatePhotos,
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not upload this photo.")),
  });
  const removePhotoMutation = useMutation({
    mutationFn: (photo: RouteStopPhotoRow) => removeRouteStopPhoto(photo.id, photo.storage_path),
    onSuccess: invalidatePhotos,
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not remove this photo.")),
  });

  return (
    <div>
      <Link
        to="/dashboard/operations/routes/$id"
        params={{ id }}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to route
      </Link>

      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium">
          {stop.animal_label || `${stop.city ?? "?"}, ${stop.country ?? "?"}`}
        </h1>
        {stop.planned_time && (
          <p className="text-sm text-muted-foreground">
            {new Date(stop.planned_time).toLocaleString("en-GB")}
          </p>
        )}
      </header>

      <StopLegCard
        title="Pickup"
        mapsUrl={stop.pickup_maps_url}
        addressText={stop.pickup_address_text}
        contactName={stop.pickup_contact_name}
        contactPhone={stop.pickup_contact_phone}
        notes={stop.pickup_notes}
        editing={editingPickup}
        onToggleEdit={() => setEditingPickup((v) => !v)}
      >
        <div className="space-y-3">
          <div>
            <Label>Google Maps link</Label>
            <Input placeholder="https://maps.google.com/…" {...mapsUrlField("pickup_maps_url")} />
          </div>
          <div>
            <Label>Address</Label>
            <Input placeholder="Street, city" {...addressField("pickup_address_text")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Contact name</Label>
              <Input {...field("pickup_contact_name")} />
            </div>
            <div>
              <Label>Contact phone</Label>
              <Input {...field("pickup_contact_phone")} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} {...field("pickup_notes")} />
          </div>
        </div>
      </StopLegCard>

      <StopLegCard
        title="Drop-off"
        mapsUrl={stop.dropoff_maps_url}
        addressText={stop.dropoff_address_text}
        contactName={stop.dropoff_contact_name}
        contactPhone={stop.dropoff_contact_phone}
        notes={stop.dropoff_notes}
        editing={editingDropoff}
        onToggleEdit={() => setEditingDropoff((v) => !v)}
      >
        <div className="space-y-3">
          <div>
            <Label>Google Maps link</Label>
            <Input placeholder="https://maps.google.com/…" {...mapsUrlField("dropoff_maps_url")} />
          </div>
          <div>
            <Label>Address</Label>
            <Input placeholder="Street, city" {...addressField("dropoff_address_text")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Contact name</Label>
              <Input {...field("dropoff_contact_name")} />
            </div>
            <div>
              <Label>Contact phone</Label>
              <Input {...field("dropoff_contact_phone")} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} {...field("dropoff_notes")} />
          </div>
        </div>
      </StopLegCard>

      <div className="mb-6 rounded-2xl border border-border/70 bg-card p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Extra contacts
        </p>
        {(contactsQuery.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No extra contacts yet — add one if more than one person needs to be reached.
          </p>
        ) : (
          <div className="space-y-2">
            {(contactsQuery.data ?? []).map((c: RouteStopContactRow) => (
              <div
                key={c.id}
                className="flex items-start justify-between gap-2 rounded-lg bg-secondary/40 p-2"
              >
                <div className="text-sm">
                  <div className="font-medium">
                    {c.contact_name}
                    {c.role_label && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        ({c.role_label})
                      </span>
                    )}
                  </div>
                  {c.contact_phone && (
                    <a
                      href={`tel:${c.contact_phone}`}
                      className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                    >
                      <Phone className="size-3" /> {c.contact_phone}
                    </a>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={removeContactMutation.isPending}
                  onClick={() => removeContactMutation.mutate(c.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 sm:grid-cols-3">
          <Input
            placeholder="Role"
            value={contactForm.role_label}
            onChange={(e) => setContactForm((f) => ({ ...f, role_label: e.target.value }))}
          />
          <Input
            placeholder="Name"
            value={contactForm.contact_name}
            onChange={(e) => setContactForm((f) => ({ ...f, contact_name: e.target.value }))}
          />
          <Input
            placeholder="Phone"
            value={contactForm.contact_phone}
            onChange={(e) => setContactForm((f) => ({ ...f, contact_phone: e.target.value }))}
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          disabled={!contactForm.contact_name.trim() || addContactMutation.isPending}
          onClick={() => addContactMutation.mutate()}
        >
          <UserPlus className="mr-1 size-4" /> Add contact
        </Button>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Microchip & photos
        </p>
        <div>
          <Label>Microchip number</Label>
          <Input placeholder="15-digit ISO chip number" {...field("microchip_number")} />
        </div>
        {recognition && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-accent/10 p-3 text-sm">
            <ScanLine className="mt-0.5 size-4 shrink-0 text-accent" />
            <div>
              <p className="font-medium">This chip has been transported before</p>
              <p className="text-xs text-muted-foreground">
                {recognition.times_transported === 1
                  ? "Transported once before"
                  : `Transported ${recognition.times_transported} times before`}
                {recognition.last_transported_at &&
                  ` · last on ${new Date(recognition.last_transported_at).toLocaleDateString("en-GB")}`}
              </p>
              {!!recognition.companies?.length && (
                <p className="text-xs text-muted-foreground">
                  By: {recognition.companies.join(", ")}
                </p>
              )}
              {recognition.known_pedigree_dog_slug && (
                <Link
                  to="/dogs/$slug"
                  params={{ slug: recognition.known_pedigree_dog_slug }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View pedigree profile
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="mt-4">
          <Label>Photos</Label>
          {(photosQuery.data ?? []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(photosQuery.data ?? []).map((photo) => (
                <RouteStopPhotoThumb
                  key={photo.id}
                  photo={photo}
                  onRemove={() => removePhotoMutation.mutate(photo)}
                  removing={removePhotoMutation.isPending}
                />
              ))}
            </div>
          )}
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-primary hover:underline">
            <Camera className="size-4" /> Add photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadPhotoMutation.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadPhotoMutation.mutate(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function StopLegCard({
  title,
  mapsUrl,
  addressText,
  contactName,
  contactPhone,
  notes,
  editing,
  onToggleEdit,
  children,
}: {
  title: string;
  mapsUrl: string | null;
  addressText: string | null;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
  editing: boolean;
  onToggleEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 rounded-2xl border border-border/70 bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <Button size="sm" variant="ghost" onClick={onToggleEdit}>
          <Pencil className="mr-1 size-3.5" /> {editing ? "Done" : "Edit"}
        </Button>
      </div>

      {editing ? (
        children
      ) : (
        <div className="space-y-2">
          {addressText && <p className="text-sm">{addressText}</p>}
          <div className="flex flex-wrap gap-2">
            {mapsUrl ? (
              <Button asChild size="sm" variant="outline">
                <a href={mapsUrl} target="_blank" rel="noreferrer">
                  <MapPin className="mr-1 size-3.5" /> Open in Maps
                </a>
              </Button>
            ) : (
              !addressText && (
                <span className="text-xs text-muted-foreground">No address saved</span>
              )
            )}
            {contactPhone && (
              <Button asChild size="sm" variant="outline">
                <a href={`tel:${contactPhone}`}>
                  <Phone className="mr-1 size-3.5" /> {contactName || contactPhone}
                </a>
              </Button>
            )}
          </div>
          {!contactPhone && contactName && (
            <p className="text-sm text-muted-foreground">{contactName}</p>
          )}
          {notes && <p className="text-xs text-muted-foreground">{notes}</p>}
        </div>
      )}
    </div>
  );
}

function RouteStopPhotoThumb({
  photo,
  onRemove,
  removing,
}: {
  photo: RouteStopPhotoRow;
  onRemove: () => void;
  removing: boolean;
}) {
  const urlQuery = useQuery({
    queryKey: ["route-stop-photo-url", photo.id],
    queryFn: () => getRouteStopPhotoUrl(photo.storage_path),
  });
  return (
    <div className="group relative size-20 overflow-hidden rounded-lg border border-border/60 bg-secondary/40">
      {urlQuery.data && (
        <img src={urlQuery.data} alt="" className="size-full object-cover" loading="lazy" />
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={removing}
        onClick={onRemove}
        className="absolute right-0.5 top-0.5 size-6 bg-background/80 p-0 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Trash2 className="size-3" />
      </Button>
    </div>
  );
}
