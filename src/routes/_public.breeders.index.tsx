import { createFileRoute } from "@tanstack/react-router";
import { listApprovedKennels } from "@/lib/queries/marketplace";
import { BreederCard } from "@/components/cards";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_public/breeders/")({
  loader: () => listApprovedKennels(),
  head: () => ({ meta: [{ title: "Verified breeders — Havenpaw" }] }),
  component: BreedersList,
});

function BreedersList() {
  const breeders = Route.useLoaderData();
  return (
    <div className="container-page py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-accent">
            Verified breeders
          </p>
          <h1 className="mt-1 font-display text-4xl font-medium">
            Kennels we've vetted personally
          </h1>
          <p className="mt-1 text-muted-foreground">
            Each kennel has been checked for identity, association membership and breeding practice.
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search kennel or breed" />
        </div>
      </header>
      {breeders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No verified kennels yet — check back soon.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {breeders.map((b) => (
            <BreederCard key={b.id} b={b} />
          ))}
        </div>
      )}
    </div>
  );
}
