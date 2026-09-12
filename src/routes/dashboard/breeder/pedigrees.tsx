import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileUp, Check } from "lucide-react";
import { usePostHog } from "posthog-js/react";

import { useAuth } from "@/domains/identity";
import { getMyKennel } from "@/domains/breeders";
import {
  attachBreederPedigreeSource,
  listKennelDogIdentities,
  type KennelDogIdentity,
} from "@/domains/pedigrees";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/breeder/pedigrees")({
  component: BreederPedigreesPage,
});

// Proves the "enter information once, reuse it everywhere" path: a parent dog the breeder already
// owns already has a permanent `dogs` identity (part 1's trigger). Here the breeder attaches a
// pedigree source document to it and links its sire/dam from the kennel's own dogs — no
// re-typing, and it becomes canonical immediately because ownership is verified server-side (no
// moderation queue for a verified owner's own dog).
function BreederPedigreesPage() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const { data: kennel } = useQuery({
    queryKey: ["my-kennel", userId],
    enabled: !!userId,
    queryFn: () => getMyKennel(userId!),
  });

  const { data: dogs, isLoading } = useQuery({
    queryKey: ["kennel-dog-identities", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listKennelDogIdentities(kennel!.id),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">{t("breederPanel.pedigrees.title")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("breederPanel.pedigrees.subtitle")}
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("breederPanel.pedigrees.loading")}</p>
      ) : !dogs?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("breederPanel.pedigrees.emptyBody")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dogs.map((dog) => (
            <DogPedigreeRow
              key={dog.parentDogId}
              dog={dog}
              orgId={kennel!.id}
              allDogs={dogs}
              onSaved={() => queryClient.invalidateQueries({ queryKey: ["kennel-dog-identities"] })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DogPedigreeRow({
  dog,
  orgId,
  allDogs,
  onSaved,
}: {
  dog: KennelDogIdentity;
  orgId: string;
  allDogs: KennelDogIdentity[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sireId, setSireId] = useState("");
  const [damId, setDamId] = useState("");
  const posthog = usePostHog();
  const [saved, setSaved] = useState(false);
  const { t } = useTranslation();

  const sires = allDogs.filter((d) => d.dogId && d.dogId !== dog.dogId && d.sex !== "female");
  const dams = allDogs.filter((d) => d.dogId && d.dogId !== dog.dogId && d.sex !== "male");

  const save = useMutation({
    mutationFn: async () => {
      if (!dog.dogId) {
        throw new Error(t("breederPanel.pedigrees.noPermanentIdentity"));
      }
      await attachBreederPedigreeSource({
        dogId: dog.dogId,
        orgId,
        document: file ?? undefined,
        sireDogId: sireId || null,
        damDogId: damId || null,
        notes: null,
      });
    },
    onSuccess: () => {
      posthog.capture("pedigree_source_attached", { has_document: !!file });
      setSaved(true);
      setOpen(false);
      onSaved();
      toast.success(t("breederPanel.pedigrees.attached"));
    },
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("breederPanel.pedigrees.couldNotAttach"))),
  });

  return (
    <article className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-display text-lg font-semibold">{dog.registeredName}</div>
          <div className="text-xs capitalize text-muted-foreground">
            {dog.sex ?? t("breederPanel.pedigrees.unknownSex")}
            {!dog.isActive && ` · ${t("breederPanel.pedigrees.retired")}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <Badge variant="secondary" className="gap-1">
              <Check className="size-3" /> {t("breederPanel.pedigrees.attachedBadge")}
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            <FileUp className="mr-1.5 size-4" />{" "}
            {open ? t("breederPanel.pedigrees.cancel") : t("breederPanel.pedigrees.addPedigree")}
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 grid-cols-1 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-muted-foreground">
              {t("breederPanel.pedigrees.documentLabel")}
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="mt-1 block text-sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              {t("breederPanel.pedigrees.sire")}
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
              value={sireId}
              onChange={(e) => setSireId(e.target.value)}
            >
              <option value="">— {t("breederPanel.pedigrees.none")} —</option>
              {sires.map((s) => (
                <option key={s.parentDogId} value={s.dogId ?? ""}>
                  {s.registeredName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              {t("breederPanel.pedigrees.dam")}
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
              value={damId}
              onChange={(e) => setDamId(e.target.value)}
            >
              <option value="">— {t("breederPanel.pedigrees.none")} —</option>
              {dams.map((s) => (
                <option key={s.parentDogId} value={s.dogId ?? ""}>
                  {s.registeredName}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending
                ? t("breederPanel.pedigrees.saving")
                : t("breederPanel.pedigrees.attachPedigree")}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
