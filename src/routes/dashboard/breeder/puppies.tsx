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
import { useTranslation } from "@/shared/i18n";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";

export const Route = createFileRoute("/dashboard/breeder/puppies")({
  component: PuppiesPage,
});

type PuppyStatus = AnimalRow["availability_status"];
type SettableStatus = Extract<
  PuppyStatus,
  "available" | "applications_open" | "reserved" | "sold" | "withdrawn"
>;

// The subset of the full availability_status enum a breeder sets themselves day to day (draft is
// controlled by the separate publish toggle; adopted/unavailable belong to foundation listings).
const STATUS_ICON: Record<SettableStatus, LucideIcon> = {
  available: Heart,
  applications_open: Clock,
  reserved: Bookmark,
  sold: Home,
  withdrawn: XCircle,
};
const STATUS_BADGE_CLASS: Record<SettableStatus, string> = {
  available: "bg-success/15 text-success border-success/30",
  applications_open: "bg-accent/15 text-accent border-accent/30",
  reserved: "bg-warning/20 text-foreground border-warning/40",
  sold: "bg-muted text-muted-foreground border-border",
  withdrawn: "bg-muted text-muted-foreground border-border",
};
const STATUS_ORDER = Object.keys(STATUS_ICON) as SettableStatus[];

function useStatusMeta() {
  const { t } = useTranslation();
  const meta: Record<SettableStatus, { label: string; hint: string }> = {
    available: {
      label: t("breederPanel.status.puppy.available"),
      hint: t("breederPanel.status.puppy.availableHint"),
    },
    applications_open: {
      label: t("breederPanel.status.puppy.applicationsOpen"),
      hint: t("breederPanel.status.puppy.applicationsOpenHint"),
    },
    reserved: {
      label: t("breederPanel.status.puppy.reserved"),
      hint: t("breederPanel.status.puppy.reservedHint"),
    },
    sold: {
      label: t("breederPanel.status.puppy.sold"),
      hint: t("breederPanel.status.puppy.soldHint"),
    },
    withdrawn: {
      label: t("breederPanel.status.puppy.withdrawn"),
      hint: t("breederPanel.status.puppy.withdrawnHint"),
    },
  };
  return meta;
}

function PuppiesPage() {
  const { userId } = useAuth();
  const { t } = useTranslation();
  const statusMeta = useStatusMeta();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | SettableStatus>("all");
  const [statusEdit, setStatusEdit] = useState<{ id: string; status: PuppyStatus } | null>(null);

  const FILTERS: { key: "all" | SettableStatus; label: string }[] = [
    { key: "all", label: t("breederPanel.puppies.filterAll") },
    { key: "available", label: t("breederPanel.puppies.filterAvailable") },
    { key: "applications_open", label: t("breederPanel.puppies.filterApplicationsOpen") },
    { key: "reserved", label: t("breederPanel.puppies.filterReserved") },
    { key: "sold", label: t("breederPanel.puppies.filterSold") },
  ];

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
      toast.success(t("breederPanel.puppies.statusUpdated"));
      setStatusEdit(null);
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("breederPanel.puppyForm.saveFailed"))),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      updatePuppy(id, {
        is_published: isPublished,
        availability_status: isPublished ? "available" : "draft",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kennel-puppies"] });
      toast.success(t("breederPanel.puppyForm.savedUpdated"));
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("breederPanel.puppyForm.saveFailed"))),
  });

  const litterOptions = (litters ?? []).map((l) => ({ id: l.id, code: l.code }));
  const filtered =
    filter === "all"
      ? (puppies ?? [])
      : (puppies ?? []).filter((p) => p.availability_status === filter);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">
          {t("breederPanel.puppies.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("breederPanel.puppies.subtitle")}</p>
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
                <Plus className="size-5" /> {t("breederPanel.puppies.addPuppy")}
              </Button>
            }
          />
        ) : (
          <Button asChild variant="outline" className="h-14 w-full rounded-2xl text-base font-bold">
            <Link to="/dashboard/breeder/litters">{t("breederPanel.puppies.addLitterFirst")}</Link>
          </Button>
        ))}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("breederPanel.puppies.loading")}</p>
      ) : !filtered.length ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-card/50 p-8 text-center">
          <p className="text-base font-semibold">
            {!puppies?.length
              ? litterOptions.length
                ? t("breederPanel.puppies.emptyHasLitter")
                : t("breederPanel.puppies.emptyNoLitterYet")
              : t("breederPanel.puppies.emptyFilterNoMatch")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const photo = animalCoverPhotoUrl(p);
            const settable = p.availability_status as SettableStatus;
            const meta = statusMeta[settable];
            const Icon = STATUS_ICON[settable];
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
                  {meta && Icon && (
                    <span
                      className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${STATUS_BADGE_CLASS[settable]}`}
                    >
                      <Icon className="size-3.5" />
                      {meta.label}
                    </span>
                  )}
                  {!p.is_published && (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-border bg-background/90 px-3 py-1 text-xs font-bold text-muted-foreground">
                      <EyeOff className="size-3.5" /> {t("breederPanel.puppies.draftBadge")}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-display text-xl font-bold">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.breeds?.name ?? t("breederPanel.home.breedNotSet")} ·{" "}
                    {p.sex ?? t("breederPanel.puppies.sexNotSet")}
                    {p.litters?.code && ` · ${p.litters.code}`}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => setStatusEdit({ id: p.id, status: p.availability_status })}
                      className="h-12 flex-1 rounded-2xl text-base font-bold"
                    >
                      {t("breederPanel.puppies.changeStatus")}
                    </Button>
                    <PuppyFormDialog
                      kennelId={kennel!.id}
                      puppy={p}
                      trigger={
                        <Button
                          variant="outline"
                          className="h-12 rounded-2xl border-2 text-base font-bold"
                        >
                          {t("breederPanel.puppies.edit")}
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
                        <EyeOff className="size-4" /> {t("breederPanel.puppies.unpublishFromSite")}
                      </>
                    ) : (
                      <>
                        <Eye className="size-4" /> {t("breederPanel.puppies.publishToSite")}
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
  const { t } = useTranslation();
  const statusMeta = useStatusMeta();
  const [selected, setSelected] = useState<SettableStatus>("available");

  return (
    <Dialog
      open={!!current}
      onOpenChange={(open) => {
        if (!open) onClose();
        else if (current && current.status in statusMeta) {
          setSelected(current.status as SettableStatus);
        }
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {t("breederPanel.puppies.statusDialogTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {STATUS_ORDER.map((key) => {
            const meta = statusMeta[key];
            const Icon = STATUS_ICON[key];
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
                  className={`flex size-12 shrink-0 items-center justify-center rounded-2xl border ${STATUS_BADGE_CLASS[key]}`}
                >
                  <Icon className="size-6" />
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
          {pending ? t("breederPanel.puppies.saving") : t("breederPanel.puppies.saveStatus")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
