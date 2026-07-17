import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, Map, LayoutGrid, List, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { listPublishedPuppies } from "@/lib/queries/marketplace";
import { PuppyCard } from "@/components/cards";

export const Route = createFileRoute("/_public/find-a-dog")({
  loader: () => listPublishedPuppies(),
  head: () => ({
    meta: [
      { title: "Find a dog — Havenpaw" },
      { name: "description", content: "Browse puppies from verified European breeders." },
    ],
  }),
  component: FindADog,
});

const breedOptions = [
  ["all", "All breeds"],
  ["Golden Retriever", "Golden Retriever"],
  ["Border Collie", "Border Collie"],
  ["Labrador Retriever", "Labrador Retriever"],
  ["German Shepherd", "German Shepherd"],
  ["Bernese Mountain Dog", "Bernese Mountain Dog"],
  ["French Bulldog", "French Bulldog"],
] as const;

const countryOptions = [
  ["all", "All Europe"],
  ["Poland", "Poland"],
  ["Germany", "Germany"],
  ["Netherlands", "Netherlands"],
  ["Czech Republic", "Czech Republic"],
] as const;

const defaultFilters = {
  search: "",
  breed: "all",
  country: "all",
  price: [1000, 20000] as [number, number],
  availableOnly: false,
  applicationsOpenOnly: false,
  male: false,
  female: false,
  transportOnly: false,
  verifiedOnly: false,
  readyFrom: "",
  sort: "newest",
};

function FindADog() {
  const puppies = Route.useLoaderData();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [f, setF] = useState(defaultFilters);

  const filtered = useMemo(() => {
    const rows = puppies.filter((p) => {
      if (f.search.trim()) {
        const q = f.search.trim().toLowerCase();
        const haystack = `${p.name} ${p.breed} ${p.kennel} ${p.city} ${p.country}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (f.breed !== "all" && p.breed !== f.breed) return false;
      if (f.country !== "all" && p.country !== f.country) return false;
      if (p.pricePLN < f.price[0] || p.pricePLN > f.price[1]) return false;
      if (f.male || f.female) {
        const wantsMale = f.male && p.sex === "Male";
        const wantsFemale = f.female && p.sex === "Female";
        if (!wantsMale && !wantsFemale) return false;
      }
      if (f.availableOnly || f.applicationsOpenOnly) {
        const matches =
          (f.availableOnly && p.status === "available") ||
          (f.applicationsOpenOnly && p.status === "applications-open");
        if (!matches) return false;
      }
      if (f.transportOnly && !p.transportAvailable) return false;
      if (f.verifiedOnly && !p.verified) return false;
      if (f.readyFrom && new Date(p.readyDate) < new Date(f.readyFrom)) return false;
      return true;
    });

    const sorted = [...rows];
    if (f.sort === "price") sorted.sort((a, b) => a.pricePLN - b.pricePLN);
    else if (f.sort === "ready") {
      sorted.sort((a, b) => new Date(a.readyDate).getTime() - new Date(b.readyDate).getTime());
    }
    // "newest" keeps the loader's own order (already created_at desc from the query).
    return sorted;
  }, [puppies, f]);

  function update<K extends keyof typeof f>(key: K, value: (typeof f)[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="container-page py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">Find a dog</h1>
          <p className="text-sm text-muted-foreground">
            Showing {filtered.length} of {puppies.length} puppies from verified breeders across
            Europe ·{" "}
            <Link to="/find-your-dog" className="text-primary hover:underline">
              Not sure where to start? Try our guided search
            </Link>
          </p>
        </div>
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search breed, kennel, city…"
            className="pl-9"
            value={f.search}
            onChange={(e) => update("search", e.target.value)}
          />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl border border-border/70 bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <SlidersHorizontal className="size-4" /> Filters
            </h2>
            <button
              type="button"
              onClick={() => setF(defaultFilters)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Reset
            </button>
          </div>

          <FilterGroup title="Breed">
            <Select value={f.breed} onValueChange={(v) => update("breed", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {breedOptions.map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterGroup>

          <FilterGroup title="Country">
            <Select value={f.country} onValueChange={(v) => update("country", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {countryOptions.map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterGroup>

          <FilterGroup title="Availability">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={f.availableOnly}
                  onCheckedChange={(v) => update("availableOnly", !!v)}
                />{" "}
                Available now
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={f.applicationsOpenOnly}
                  onCheckedChange={(v) => update("applicationsOpenOnly", !!v)}
                />{" "}
                Applications open
              </label>
            </div>
          </FilterGroup>

          <FilterGroup title="Sex">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={f.male} onCheckedChange={(v) => update("male", !!v)} /> Male
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={f.female} onCheckedChange={(v) => update("female", !!v)} />{" "}
                Female
              </label>
            </div>
          </FilterGroup>

          <FilterGroup
            title={`Price (PLN) — ${f.price[0].toLocaleString()} – ${f.price[1].toLocaleString()}`}
          >
            <Slider
              value={f.price}
              onValueChange={(v) => update("price", v as [number, number])}
              min={1000}
              max={20000}
              step={100}
            />
          </FilterGroup>

          <FilterGroup title="Collection-ready from">
            <Input
              type="date"
              value={f.readyFrom}
              onChange={(e) => update("readyFrom", e.target.value)}
            />
          </FilterGroup>

          <FilterGroup title="Verification & transport">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={f.verifiedOnly}
                  onCheckedChange={(v) => update("verifiedOnly", !!v)}
                />{" "}
                Verified breeders only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={f.transportOnly}
                  onCheckedChange={(v) => update("transportOnly", !!v)}
                />{" "}
                Transport available
              </label>
            </div>
          </FilterGroup>
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3">
            <div className="text-sm text-muted-foreground">
              <strong className="text-foreground">{filtered.length}</strong> results
            </div>
            <div className="flex items-center gap-2">
              <Select value={f.sort} onValueChange={(v) => update("sort", v)}>
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Sort: Newest</SelectItem>
                  <SelectItem value="ready">Sort: Collection date</SelectItem>
                  <SelectItem value="price">Sort: Price</SelectItem>
                </SelectContent>
              </Select>
              <Separator orientation="vertical" className="h-6" />
              <Button
                size="sm"
                variant={view === "grid" ? "default" : "ghost"}
                onClick={() => setView("grid")}
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button
                size="sm"
                variant={view === "list" ? "default" : "ghost"}
                onClick={() => setView("list")}
              >
                <List className="size-4" />
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/breeder-map">
                  <Map className="mr-1 size-4" /> Map view
                </Link>
              </Button>
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No puppies match right now — check back soon, or widen your filters.
              </p>
              {puppies.length > 0 && (
                <Button variant="outline" className="mt-4" onClick={() => setF(defaultFilters)}>
                  Clear filters
                </Button>
              )}
            </div>
          )}

          {view === "grid" ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => (
                <PuppyCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((p) => (
                <Link
                  key={p.id}
                  to="/puppies/$id"
                  params={{ id: p.id }}
                  className="grid gap-4 rounded-2xl border border-border/70 bg-card p-3 transition-colors hover:bg-secondary/40 md:grid-cols-[180px_1fr_auto]"
                >
                  <img
                    src={p.image}
                    alt={p.name}
                    className="aspect-[4/3] w-full rounded-xl object-cover"
                  />
                  <div className="flex flex-col gap-2 py-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl font-semibold">{p.name}</h3>
                      <Badge variant="secondary">{p.breed}</Badge>
                      <Badge variant="secondary">{p.sex}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{p.about}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" /> {p.city}, {p.country}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3" /> Ready{" "}
                        {new Date(p.readyDate).toLocaleDateString("en-GB")}
                      </span>
                      <span>{p.kennel}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between py-1 pr-3">
                    <div className="text-right">
                      <div className="font-display text-lg font-semibold">
                        {p.pricePLN.toLocaleString()} PLN
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ≈ €{p.priceEUR.toLocaleString()}
                      </div>
                    </div>
                    <Button size="sm">View puppy</Button>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <Label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </Label>
      {children}
    </div>
  );
}
