import { createFileRoute, Link } from "@tanstack/react-router";
import { HeartHandshake } from "lucide-react";
import { listPublishedAdoptions } from "@/lib/queries/marketplace";
import { AdoptionCard } from "@/components/cards";

export const Route = createFileRoute("/_public/adoptions")({
  loader: () => listPublishedAdoptions(),
  head: () => ({
    meta: [
      { title: "Dogs for adoption — Havenpaw" },
      {
        name: "description",
        content: "Browse dogs looking for a new home from verified foundations and private owners.",
      },
    ],
  }),
  component: AdoptionsPage,
});

function AdoptionsPage() {
  const animals = Route.useLoaderData();
  return (
    <div className="container-page py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">Dogs for adoption</h1>
          <p className="text-sm text-muted-foreground">
            {animals.length
              ? `${animals.length} dog${animals.length === 1 ? "" : "s"} looking for a new home, from verified foundations and reviewed private owners.`
              : "From verified foundations and reviewed private owners."}
          </p>
        </div>
        <Link to="/rehome" className="text-sm text-primary hover:underline">
          Looking to rehome your own dog instead?
        </Link>
      </header>

      {animals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <HeartHandshake className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No adoption listings published yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Check back soon — approved foundations and reviewed private rehoming submissions appear
            here.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {animals.map((a) => (
            <AdoptionCard key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}
