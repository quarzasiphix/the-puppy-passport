import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileUp, Check } from "lucide-react";

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

export const Route = createFileRoute("/dashboard/breeder/pedigrees")({
  component: BreederPedigreesPage,
});

// Proves the "enter information once, reuse it everywhere" path: a parent dog the breeder already
// owns already has a permanent `dogs` identity (part 1's trigger). Here the breeder attaches a
// pedigree source document to it and links its sire/dam from the kennel's own dogs — no
// re-typing, and it becomes canonical immediately because ownership is verified server-side (no
// moderation queue for a verified owner's own dog).
function BreederPedigreesPage() {
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
        <h1 className="font-display text-3xl font-medium">Pedigrees</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Attach a pedigree document and parentage to a dog you already have. It is entered once
          here and reused on the dog&apos;s public page and every litter it appears in — you never
          re-type it per puppy.
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !dogs?.length ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No parent dogs yet. Add them under “Parent dogs” first.
          </p>
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
  const [saved, setSaved] = useState(false);

  const sires = allDogs.filter((d) => d.dogId && d.dogId !== dog.dogId && d.sex !== "female");
  const dams = allDogs.filter((d) => d.dogId && d.dogId !== dog.dogId && d.sex !== "male");

  const save = useMutation({
    mutationFn: async () => {
      if (!dog.dogId) {
        throw new Error(
          "This dog has no permanent identity yet — the pedigree-graph migration must be applied first.",
        );
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
      setSaved(true);
      setOpen(false);
      onSaved();
      toast.success("Pedigree attached.");
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not attach the pedigree.")),
  });

  return (
    <article className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-display text-lg font-semibold">{dog.registeredName}</div>
          <div className="text-xs capitalize text-muted-foreground">
            {dog.sex ?? "unknown sex"}
            {!dog.isActive && " · retired"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <Badge variant="secondary" className="gap-1">
              <Check className="size-3" /> Attached
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            <FileUp className="mr-1.5 size-4" /> {open ? "Cancel" : "Add pedigree"}
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-muted-foreground">
              Pedigree document (scan / PDF) — optional
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="mt-1 block text-sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Sire</label>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
              value={sireId}
              onChange={(e) => setSireId(e.target.value)}
            >
              <option value="">— none —</option>
              {sires.map((s) => (
                <option key={s.parentDogId} value={s.dogId ?? ""}>
                  {s.registeredName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Dam</label>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
              value={damId}
              onChange={(e) => setDamId(e.target.value)}
            >
              <option value="">— none —</option>
              {dams.map((s) => (
                <option key={s.parentDogId} value={s.dogId ?? ""}>
                  {s.registeredName}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Attach pedigree"}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
