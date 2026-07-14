import { createFileRoute } from "@tanstack/react-router";
import { plannedLitters } from "@/lib/mock-data";
import { LitterCard } from "@/components/cards";

export const Route = createFileRoute("/_public/planned-litters")({
  head: () => ({ meta: [{ title: "Planned litters — Havenpaw" }] }),
  component: PlannedLittersPage,
});

function PlannedLittersPage() {
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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plannedLitters.map((l) => <LitterCard key={l.id} l={l} planned />)}
      </div>
    </div>
  );
}
