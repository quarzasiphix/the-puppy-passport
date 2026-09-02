import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/domains/identity";
import { getKennelLitter, getMyKennel, listLitterPuppies } from "@/domains/breeders";
import { LitterFormDialog } from "@/domains/animals";
import { PuppyFormDialog } from "@/domains/animals";
import { Card } from "@/shared/ui/panel";

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
    <div>
      <Link
        to="/dashboard/breeder/litters"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> All litters
      </Link>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">{litter.code}</h1>
          <p className="text-sm text-muted-foreground">
            {litter.breeds?.name ?? "Breed not set"}
            {litter.birth_date &&
              ` · Born ${new Date(litter.birth_date).toLocaleDateString("en-GB")}`}
            {litter.ready_date &&
              ` · Ready ${new Date(litter.ready_date).toLocaleDateString("en-GB")}`}
          </p>
          <div className="mt-2 flex gap-1.5">
            <Badge variant="secondary" className="capitalize">
              {litter.status.replace(/_/g, " ")}
            </Badge>
            {!litter.is_published && <Badge variant="outline">Draft — not visible publicly</Badge>}
          </div>
        </div>
        {kennel?.id && (
          <div className="flex gap-2">
            <LitterFormDialog
              kennelId={kennel.id}
              litter={litter}
              trigger={<Button variant="outline">Edit litter</Button>}
            />
            <PuppyFormDialog
              kennelId={kennel.id}
              litterId={litter.id}
              defaultBreedId={litter.breed_id ?? undefined}
              defaultDateOfBirth={litter.birth_date ?? undefined}
              trigger={<Button>Add puppy</Button>}
            />
          </div>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card title="Puppies in this litter">
          {!kPuppies?.length ? (
            <p className="text-sm text-muted-foreground">
              No puppies added yet. Use "Add puppy" once they're born, or now if you already know
              how many there'll be.
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {kPuppies.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-background p-3"
                >
                  <div className="flex-1">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.sex ?? "sex not set"} · {p.color ?? "color not set"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="secondary" className="capitalize">
                      {p.availability_status.replace(/_/g, " ")}
                    </Badge>
                    {kennel?.id && (
                      <PuppyFormDialog
                        kennelId={kennel.id}
                        puppy={p}
                        trigger={
                          <button className="text-xs text-primary hover:underline">Edit</button>
                        }
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Shared parent info">
            <ul className="space-y-2 text-sm">
              <li>
                <strong>Mother:</strong> {litter.mother?.registered_name ?? "Not set"}
                {litter.mother?.pedigree_number && (
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    ({litter.mother.pedigree_number})
                  </span>
                )}
              </li>
              <li>
                <strong>Father:</strong> {litter.father?.registered_name ?? "Not set"}
                {litter.father?.pedigree_number && (
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    ({litter.father.pedigree_number})
                  </span>
                )}
              </li>
              <li>
                <strong>Registration:</strong> {litter.registration_number || "Not set"}
              </li>
              <li>
                <strong>Association:</strong> {litter.association || "Not set"}
              </li>
              <li>
                <strong>Expected litter size:</strong> {litter.puppy_count ?? "Not set"}
              </li>
            </ul>
          </Card>
          <p className="rounded-xl border border-dashed border-border/70 p-3 text-xs text-muted-foreground">
            All puppies in this litter share the same parents and litter registration — you only
            need to fill in what's specific to each puppy.
          </p>
        </div>
      </div>
    </div>
  );
}
