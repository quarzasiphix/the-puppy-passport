import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { listApprovedKennels } from "@/lib/queries/marketplace";
import { BreederCard } from "@/components/cards";
import { EmptyState } from "@/components/public/empty-state";

export const Route = createFileRoute("/_public/breeder-map")({
  loader: () => listApprovedKennels(),
  head: () => ({
    meta: [
      { title: "Breeder map — Anemalo" },
      {
        name: "description",
        content: "Browse verified breeders by country and city across Europe.",
      },
    ],
  }),
  component: BreederMapPage,
});

function BreederMapPage() {
  const breeders = Route.useLoaderData();
  const [country, setCountry] = useState<string | null>(null);

  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of breeders) {
      if (!b.country) continue;
      counts.set(b.country, (counts.get(b.country) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [breeders]);

  const filtered = country ? breeders.filter((b) => b.country === country) : breeders;

  const byCity = useMemo(() => {
    const groups = new Map<string, typeof breeders>();
    for (const b of filtered) {
      const key = b.city || "Unknown city";
      groups.set(key, [...(groups.get(key) ?? []), b]);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="container-page py-10">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">Discover</p>
        <h1 className="mt-2 font-display text-3xl font-medium">Breeder map</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verified breeders grouped by country and city. Only approximate locations are ever shown —
          exact addresses stay private, even from Anemalo's own team until a transport is being
          arranged.
        </p>
      </header>

      {countries.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setCountry(null)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              !country
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            All countries ({breeders.length})
          </button>
          {countries.map(([c, count]) => (
            <button
              key={c}
              onClick={() => setCountry(c)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                country === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              {c} ({count})
            </button>
          ))}
        </div>
      )}

      {breeders.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No verified breeders published yet"
          description="Check back soon as more kennels complete verification."
        />
      ) : (
        <div className="space-y-8">
          {byCity.map(([city, kennels]) => (
            <section key={city}>
              <div className="mb-3 flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                <h2 className="font-display text-lg font-semibold">{city}</h2>
                <Badge variant="secondary">{kennels.length}</Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {kennels.map((b) => (
                  <BreederCard key={b.id} b={b} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
