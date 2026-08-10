import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { listApprovedKennels } from "@/lib/queries/marketplace";
import { BreederCard } from "@/components/cards";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { EmptyState } from "@/components/public/empty-state";

export const Route = createFileRoute("/_public/breeders/")({
  loader: () => listApprovedKennels(),
  head: () => ({
    meta: [
      { title: "Verified breeders — Anemalo" },
      {
        name: "description",
        content:
          "Browse verified dog breeders across Europe, checked for identity, association membership and breeding practice.",
      },
    ],
  }),
  component: BreedersList,
});

function BreedersList() {
  const breeders = Route.useLoaderData();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return breeders;
    return breeders.filter((b) => {
      const haystack =
        `${b.kennel} ${b.name} ${b.breeds.join(" ")} ${b.city} ${b.country}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [breeders, search]);

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
          <Input
            className="pl-9"
            placeholder="Search kennel, breeder or breed"
            aria-label="Search kennel, breeder or breed"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>
      {filtered.length === 0 ? (
        <EmptyState
          title={
            breeders.length === 0
              ? "No verified kennels yet — check back soon."
              : "No kennels match your search — try a different kennel, breeder or breed name."
          }
          action={
            breeders.length > 0 && (
              <Button variant="outline" onClick={() => setSearch("")}>
                Clear search
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((b) => (
            <BreederCard key={b.id} b={b} />
          ))}
        </div>
      )}
    </div>
  );
}
