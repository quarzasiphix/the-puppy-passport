import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Dog, Plus } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/domains/identity";
import {
  getKennelLitter,
  getMyKennel,
  listLitterPuppies,
  animalCoverPhotoUrl,
} from "@/domains/breeders";
import { LitterFormDialog } from "@/domains/animals";
import { PuppyFormDialog } from "@/domains/animals";

export const Route = createFileRoute("/dashboard/breeder/litters/$id")({
  component: LitterDetail,
});

function LitterDetail() {
  const { id } = useParams({ from: "/dashboard/breeder/litters/$id" });
  const { userId } = useAuth();

  const { data: kennel } = useQuery({
    queryKey: ["my-kennel", userId],
    enabled: !!userId,
    queryFn: () => getMyKennel(userId!),
  });
  const { data: litter, isLoading } = useQuery({
    queryKey: ["kennel-litter", id],
    queryFn: () => getKennelLitter(id),
  });
  const { data: kPuppies } = useQuery({
    queryKey: ["litter-puppies", id],
    queryFn: () => listLitterPuppies(id),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!litter) {
    return <p className="text-sm text-muted-foreground">Litter not found.</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        to="/dashboard/breeder/litters"
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> All litters
      </Link>

      <header className="rounded-3xl bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{litter.code}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {litter.breeds?.name ?? "Breed not set"}
              {litter.birth_date &&
                ` · Born ${new Date(litter.birth_date).toLocaleDateString("en-GB")}`}
              {litter.ready_date &&
                ` · Ready ${new Date(litter.ready_date).toLocaleDateString("en-GB")}`}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="capitalize">
                {litter.status.replace(/_/g, " ")}
              </Badge>
              {!litter.is_published && (
                <Badge variant="outline">Draft — not visible publicly</Badge>
              )}
            </div>
          </div>
          {kennel?.id && (
            <LitterFormDialog
              kennelId={kennel.id}
              litter={litter}
              trigger={
                <Button variant="outline" className="h-12 rounded-2xl border-2 text-base font-bold">
                  Edit litter
                </Button>
              }
            />
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border/60 pt-5 sm:grid-cols-4">
          <ParentTile
            label="Mother"
            name={litter.mother?.registered_name}
            photo={litter.mother?.profile_image_url}
          />
          <ParentTile
            label="Father"
            name={litter.father?.registered_name}
            photo={litter.father?.profile_image_url}
          />
          <FactTile label="Registration" value={litter.registration_number || "Not set"} />
          <FactTile label="Association" value={litter.association || "Not set"} />
        </div>
      </header>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-bold">
            Puppies in this litter
            {!!kPuppies?.length && (
              <span className="ml-2 text-base font-normal text-muted-foreground">
                ({kPuppies.length})
              </span>
            )}
          </h2>
        </div>

        {kennel?.id && (
          <PuppyFormDialog
            kennelId={kennel.id}
            litterId={litter.id}
            defaultBreedId={litter.breed_id ?? undefined}
            defaultDateOfBirth={litter.birth_date ?? undefined}
            trigger={
              <Button className="mb-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold shadow-sm">
                <Plus className="size-5" /> Add a puppy to this litter
              </Button>
            }
          />
        )}

        {!kPuppies?.length ? (
          <div className="rounded-3xl border-2 border-dashed border-border bg-card/50 p-8 text-center">
            <p className="text-base font-semibold">
              No puppies added yet. Add them once born, or now if you already know how many there'll
              be.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {kPuppies.map((p) => {
              const photo = animalCoverPhotoUrl(p);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm"
                >
                  {photo ? (
                    <img src={photo} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground">
                      <Dog className="size-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.sex ?? "sex not set"} · {p.color ?? "color not set"}
                    </p>
                    <Badge variant="secondary" className="mt-1 capitalize">
                      {p.availability_status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  {kennel?.id && (
                    <PuppyFormDialog
                      kennelId={kennel.id}
                      puppy={p}
                      trigger={
                        <Button size="sm" variant="outline" className="shrink-0 rounded-xl">
                          Edit
                        </Button>
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="rounded-2xl border-2 border-dashed border-border bg-card/50 p-4 text-sm text-muted-foreground">
        All puppies in this litter share the same parents and litter registration — you only need to
        fill in what's specific to each puppy.
      </p>
    </div>
  );
}

function ParentTile({
  label,
  name,
  photo,
}: {
  label: string;
  name: string | null | undefined;
  photo?: string | null;
}) {
  return (
    <div className="flex items-center gap-2">
      {photo ? (
        <img src={photo} alt="" className="size-10 shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground">
          <Dog className="size-4" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-bold">{name || "Not set"}</p>
      </div>
    </div>
  );
}

function FactTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 truncate text-sm font-bold">{value}</p>
    </div>
  );
}
