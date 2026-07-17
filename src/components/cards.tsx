import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Calendar, Truck, ShieldCheck, Heart } from "lucide-react";
import type { Puppy, Litter, Breeder } from "@/lib/mock-data";
import type { AdoptionListing } from "@/lib/queries/marketplace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { listSavedAnimalIds, saveAnimal, unsaveAnimal } from "@/lib/queries/buyer-activity";

// Shared across every card on a page — react-query dedupes identical keys, so this is one query
// per page, not one per card.
export function useIsSaved(animalId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const savedQuery = useQuery({
    queryKey: ["saved-animal-ids", userId],
    enabled: !!userId,
    queryFn: () => listSavedAnimalIds(userId!),
    staleTime: 30_000,
  });
  const isSaved = savedQuery.data?.includes(animalId) ?? false;
  const toggle = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sign in to save listings.");
      if (isSaved) await unsaveAnimal(userId, animalId);
      else await saveAnimal(userId, animalId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-animal-ids", userId] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update."),
  });
  return { isSaved, toggle: () => toggle.mutate(), pending: toggle.isPending };
}

function SaveButton({ animalId }: { animalId: string }) {
  const { isSaved, toggle, pending } = useIsSaved(animalId);
  return (
    <button
      type="button"
      aria-label={isSaved ? "Remove from saved" : "Save"}
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      className={`absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-background/85 shadow-sm backdrop-blur transition-colors hover:text-accent ${isSaved ? "text-accent" : "text-muted-foreground"}`}
    >
      <Heart className={`size-4 ${isSaved ? "fill-current" : ""}`} />
    </button>
  );
}

export const statusStyles: Record<Puppy["status"], string> = {
  available: "bg-success/15 text-success border-success/30",
  "applications-open": "bg-accent/15 text-accent border-accent/30",
  reserved: "bg-warning/20 text-foreground border-warning/40",
  sold: "bg-muted text-muted-foreground border-border",
  draft: "bg-muted text-muted-foreground border-border",
};
export const statusLabel: Record<Puppy["status"], string> = {
  available: "Available",
  "applications-open": "Applications open",
  reserved: "Reserved",
  sold: "Sold",
  draft: "Draft",
};

export function PuppyCard({ p }: { p: Puppy }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
        <img
          src={p.image}
          alt={p.name}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusStyles[p.status]}`}
          >
            {statusLabel[p.status]}
          </span>
        </div>
        <SaveButton animalId={p.id} />
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
          {p.verified && (
            <Badge className="border-primary/30 bg-primary/90 text-primary-foreground">
              <ShieldCheck className="mr-1 size-3" /> Verified breeder
            </Badge>
          )}
          {p.transportAvailable && (
            <Badge variant="secondary" className="bg-background/85">
              <Truck className="mr-1 size-3" /> Transport
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-semibold leading-tight">{p.name}</h3>
            <p className="text-sm text-muted-foreground">
              {p.breed} · {p.sex} · {p.ageWeeks} wks
            </p>
          </div>
          <div className="text-right">
            <div className="font-display text-lg font-semibold">
              {p.pricePLN.toLocaleString()} PLN
            </div>
            <div className="text-xs text-muted-foreground">≈ €{p.priceEUR.toLocaleString()}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" /> {p.city}, {p.country}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-3.5" /> Ready{" "}
            {new Date(p.readyDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{p.kennel}</p>
        <Button asChild className="mt-auto">
          <Link to="/puppies/$id" params={{ id: p.id }}>
            View puppy
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function AdoptionCard({ a }: { a: AdoptionListing }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
        <img
          src={a.image}
          alt={a.name}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <SaveButton animalId={a.id} />
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
          {a.category === "private_rehoming" ? (
            <Badge variant="secondary" className="bg-background/85">
              Private rehoming
            </Badge>
          ) : (
            a.verified && (
              <Badge className="border-primary/30 bg-primary/90 text-primary-foreground">
                <ShieldCheck className="mr-1 size-3" /> Verified foundation
              </Badge>
            )
          )}
          {a.transportAvailable && (
            <Badge variant="secondary" className="bg-background/85">
              <Truck className="mr-1 size-3" /> Transport
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-semibold leading-tight">{a.name}</h3>
            <p className="text-sm text-muted-foreground">
              {a.breed} · {a.sex} · {a.approxAge}
            </p>
          </div>
          {a.adoptionFee != null && (
            <div className="text-right">
              <div className="font-display text-lg font-semibold">
                {a.adoptionFee.toLocaleString()} {a.currency}
              </div>
              <div className="text-xs text-muted-foreground">adoption fee</div>
            </div>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5" /> {a.city}, {a.country}
        </span>
        <p className="line-clamp-2 text-sm text-muted-foreground">{a.description}</p>
        <p className="text-sm text-muted-foreground">{a.orgName}</p>
        <Button asChild className="mt-auto">
          <Link to="/adoptions/$id" params={{ id: a.id }}>
            Meet {a.name}
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function LitterCard({ l, planned = false }: { l: Litter; planned?: boolean }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="relative aspect-[16/9] overflow-hidden bg-secondary">
        <img src={l.image} alt={l.code} loading="lazy" className="size-full object-cover" />
        <Badge className="absolute left-3 top-3 border-primary/30 bg-primary/90 text-primary-foreground">
          {planned ? "Planned litter" : "Current litter"}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="font-display text-lg font-semibold">{l.breed}</h3>
          <p className="text-sm text-muted-foreground">{l.code}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Meta
            label={planned ? "Expected birth" : "Born"}
            value={new Date(l.birthDate).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          />
          <Meta
            label="Collection ready"
            value={new Date(l.readyDate).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          />
          <Meta label="Mother" value={l.mother} />
          <Meta label="Father" value={l.father} />
          <Meta label="Breeder" value={l.kennel} />
          <Meta
            label={planned ? "Approx. places" : "Available"}
            value={`${l.available} / ${l.puppyCount}`}
          />
        </dl>
        {planned && (
          <p className="rounded-lg bg-secondary/70 px-3 py-2 text-xs text-muted-foreground">
            Waiting list: {l.waitingList} {l.waitingList === 1 ? "person" : "people"}
          </p>
        )}
        <div className="mt-auto flex gap-2 pt-2">
          <Button asChild variant="outline" className="flex-1">
            <Link to="/planned-litters">View litter</Link>
          </Button>
          {planned && (
            <Button
              className="flex-1"
              disabled
              title="Litter waiting lists are coming in a later update — apply once the litter is born"
            >
              Join waiting list
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function BreederCard({ b }: { b: Breeder }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="relative aspect-[16/9] overflow-hidden bg-secondary">
        <img src={b.cover} alt={b.kennel} loading="lazy" className="size-full object-cover" />
        {b.verified && (
          <Badge className="absolute right-3 top-3 border-primary/30 bg-primary/90 text-primary-foreground">
            <ShieldCheck className="mr-1 size-3" /> Verified
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold">{b.kennel}</h3>
            <p className="text-sm text-muted-foreground">
              {b.name} · {b.city}, {b.country}
            </p>
          </div>
          {b.responseTime && (
            <div className="text-right text-sm">
              <div className="text-xs text-muted-foreground">Responds</div>
              <div className="font-medium">{b.responseTime}</div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {b.breeds.map((br) => (
            <Badge key={br} variant="secondary">
              {br}
            </Badge>
          ))}
        </div>
        <p className="line-clamp-3 text-sm text-muted-foreground">{b.description}</p>
        <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span>{b.years} yrs experience</span>
          <span>{b.availablePuppies} puppies available</span>
        </div>
        <Button asChild variant="outline" className="mt-1">
          <Link to="/breeders/$slug" params={{ slug: b.slug }}>
            View kennel
          </Link>
        </Button>
      </div>
    </article>
  );
}
