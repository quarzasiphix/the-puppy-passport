import { createFileRoute } from "@tanstack/react-router";
import { listPublishedLitters } from "@/lib/queries/marketplace";
import { LitterCard } from "@/components/cards";
import { EmptyState } from "@/components/public/empty-state";

export const Route = createFileRoute("/_public/planned-litters")({
  loader: () => listPublishedLitters("planned"),
  head: () => ({ meta: [{ title: "Planned litters — Havenpaw" }] }),
  component: PlannedLittersPage,
});

function PlannedLittersPage() {
  const plannedLitters = Route.useLoaderData();
  return (
    <div className="container-page py-10">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">Planned litters</p>
        <h1 className="mt-1 font-display text-4xl font-medium">Reserve your place ahead of time</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Waiting-list applications close before mating. Breeders confirm homes carefully, so early
          applications have the best chance.
        </p>
      </header>
      {plannedLitters.length === 0 ? (
        <EmptyState title="No planned litters right now — check back soon." />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plannedLitters.map((l) => (
            <LitterCard key={l.id} l={l} planned />
          ))}
        </div>
      )}
    </div>
  );
}
