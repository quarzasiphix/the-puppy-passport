import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Heart, Clock, Bookmark, Home, XCircle, Dog, Eye, EyeOff, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { useAuth } from "@/domains/identity";
import {
  getMyKennel,
  listKennelLitters,
  listKennelPuppies,
  updatePuppy,
  animalCoverPhotoUrl,
  type AnimalRow,
} from "@/domains/breeders";
import { PuppyFormDialog } from "@/domains/animals";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";

export const Route = createFileRoute("/dashboard/breeder/puppies")({
  component: PuppiesPage,
});

type PuppyStatus = AnimalRow["availability_status"];

// The subset of the full availability_status enum a breeder sets themselves day to day (draft is
// controlled by the separate publish toggle; adopted/unavailable belong to foundation listings).
const STATUS_META: Record<
  Extract<PuppyStatus, "available" | "applications_open" | "reserved" | "sold" | "withdrawn">,
  { label: string; hint: string; icon: LucideIcon; badgeClass: string }
> = {
  available: {
    label: "Available",
    hint: "Looking for a home",
    icon: Heart,
    badgeClass: "bg-success/15 text-success border-success/30",
  },
  applications_open: {
    label: "Applications open",
    hint: "Buyers can apply",
    icon: Clock,
    badgeClass: "bg-accent/15 text-accent border-accent/30",
  },
  reserved: {
    label: "Reserved",
    hint: "Has a buyer lined up",
    icon: Bookmark,
    badgeClass: "bg-warning/20 text-foreground border-warning/40",
  },
  sold: {
    label: "Sold / gone home",
    hint: "Already with its new family",
    icon: Home,
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
  withdrawn: {
    label: "Withdrawn",
    hint: "Not for sale right now",
    icon: XCircle,
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
};
const STATUS_ORDER = Object.keys(STATUS_META) as (keyof typeof STATUS_META)[];

const FILTERS: { key: "all" | keyof typeof STATUS_META; label: string }[] = [
  { key: "all", label: "All" },
  { key: "available", label: "Available" },
  { key: "applications_open", label: "Applications open" },
  { key: "reserved", label: "Reserved" },
  { key: "sold", label: "Sold" },
];

function PuppiesPage() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | keyof typeof STATUS_META>("all");
  const [statusEdit, setStatusEdit] = useState<{ id: string; status: PuppyStatus } | null>(null);

  const { data: kennel } = useQuery({
    queryKey: ["my-kennel", userId],
    enabled: !!userId,
    queryFn: () => getMyKennel(userId!),
  });
  const { data: puppies, isLoading } = useQuery({
    queryKey: ["kennel-puppies", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listKennelPuppies(kennel!.id),
  });
  const { data: litters } = useQuery({
    queryKey: ["kennel-litters", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listKennelLitters(kennel!.id),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PuppyStatus }) =>
      updatePuppy(id, { availability_status: status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kennel-puppies"] });
      toast.success("Status updated.");
      setStatusEdit(null);
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not update puppy.")),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      updatePuppy(id, {
        is_published: isPublished,
        availability_status: isPublished ? "available" : "draft",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kennel-puppies"] });
      toast.success("Updated.");
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not update puppy.")),
  });

  const litterOptions = (litters ?? []).map((l) => ({ id: l.id, code: l.code }));
  const filtered =
    filter === "all"
      ? (puppies ?? [])
      : (puppies ?? []).filter((p) => p.availability_status === filter);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Puppies</h1>
        <p className="text-sm text-muted-foreground">Manage individual puppy listings.</p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`h-11 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-bold transition ${
              filter === f.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-foreground/70"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {kennel?.id &&
        (litterOptions.length ? (
          <PuppyFormDialog
            kennelId={kennel.id}
            litterOptions={litterOptions}
            trigger={
              <Button className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold shadow-sm">
                <Plus className="size-5" /> Add a puppy
              </Button>
            }
          />
        ) : (
          <Button asChild variant="outline" className="h-14 w-full rounded-2xl text-base font-bold">
            <Link to="/dashboard/breeder/litters">Add a litter first</Link>
          </Button>
        ))}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !filtered.length ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-card/50 p-8 text-center">
          <p className="text-base font-semibold">
            {!puppies?.length
              ? litterOptions.length
                ? "No puppies yet. Add your first one above."
                : "No puppies yet — a litter comes first, then puppies."
              : "No puppies match this filter."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const photo = animalCoverPhotoUrl(p);
            const meta = STATUS_META[p.availability_status as keyof typeof STATUS_META] ?? null;
            return (
              <article key={p.id} className="overflow-hidden rounded-3xl bg-card shadow-sm">
                <div className="relative aspect-[5/3] bg-secondary">
                  {photo ? (
                    <img src={photo} alt={p.name} className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center text-muted-foreground">
                      <Dog className="size-10" />
                    </div>
                  )}
                  {meta && (
                    <span
                      className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${meta.badgeClass}`}
                    >
                      <meta.icon className="size-3.5" />
                      {meta.label}
                    </span>
                  )}
                  {!p.is_published && (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-border bg-background/90 px-3 py-1 text-xs font-bold text-muted-foreground">
                      <EyeOff className="size-3.5" /> Draft
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-display text-xl font-bold">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.breeds?.name ?? "Breed not set"} · {p.sex ?? "sex not set"}
                    {p.litters?.code && ` · ${p.litters.code}`}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => setStatusEdit({ id: p.id, status: p.availability_status })}
                      className="h-12 flex-1 rounded-2xl text-base font-bold"
                    >
                      Change status
                    </Button>
                    <PuppyFormDialog
                      kennelId={kennel!.id}
                      puppy={p}
                      trigger={
                        <Button
                          variant="outline"
                          className="h-12 rounded-2xl border-2 text-base font-bold"
                        >
                          Edit
                        </Button>
                      }
                    />
                  </div>
                  <button
                    onClick={() =>
                      publishMutation.mutate({ id: p.id, isPublished: !p.is_published })
                    }
                    disabled={publishMutation.isPending}
                    className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-muted-foreground hover:bg-secondary"
                  >
                    {p.is_published ? (
                      <>
                        <EyeOff className="size-4" /> Unpublish from site
                      </>
                    ) : (
                      <>
                        <Eye className="size-4" /> Publish to site
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <StatusPickerDialog
        current={statusEdit}
        pending={statusMutation.isPending}
        onClose={() => setStatusEdit(null)}
        onSave={(status) => {
          if (statusEdit) statusMutation.mutate({ id: statusEdit.id, status });
        }}
      />
    </div>
  );
}

function StatusPickerDialog({
  current,
  pending,
  onClose,
  onSave,
}: {
  current: { id: string; status: PuppyStatus } | null;
  pending: boolean;
  onClose: () => void;
  onSave: (status: PuppyStatus) => void;
}) {
  const [selected, setSelected] = useState<keyof typeof STATUS_META>("available");

  return (
    <Dialog
      open={!!current}
      onOpenChange={(open) => {
        if (!open) onClose();
        else if (current && current.status in STATUS_META) {
          setSelected(current.status as keyof typeof STATUS_META);
        }
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Change puppy status</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {STATUS_ORDER.map((key) => {
            const meta = STATUS_META[key];
            const active = selected === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition ${
                  active ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <div
                  className={`flex size-12 shrink-0 items-center justify-center rounded-2xl border ${meta.badgeClass}`}
                >
                  <meta.icon className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{meta.label}</p>
                  <p className="text-xs text-muted-foreground">{meta.hint}</p>
                </div>
                {active && <Check className="size-5 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
        <Button
          onClick={() => onSave(selected)}
          disabled={pending}
          className="h-14 w-full rounded-2xl text-base font-bold"
        >
          {pending ? "Saving…" : "Save new status"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
