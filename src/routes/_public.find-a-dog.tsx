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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { listPublishedPuppies, type PuppyWithExtras } from "@/lib/queries/marketplace";
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

// "all" plus every distinct value actually present in the loaded puppies — never a hardcoded
// breed/country list, which would either offer an option with zero real results or silently omit a
// breed/country that does have listings. Options are derived, not fabricated.
function distinctOptions(puppies: PuppyWithExtras[], pick: (p: PuppyWithExtras) => string) {
  const values = Array.from(new Set(puppies.map(pick).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
  return values;
}

function priceBoundsOf(puppies: PuppyWithExtras[]): [number, number] {
  if (puppies.length === 0) return [0, 0];
  const prices = puppies.map((p) => p.pricePLN);
  return [Math.min(...prices), Math.max(...prices)];
}

function makeDefaultFilters(priceBounds: [number, number]) {
  return {
    search: "",
    breed: "all",
    country: "all",
    price: priceBounds,
    availableOnly: false,
    applicationsOpenOnly: false,
    male: false,
    female: false,
    transportOnly: false,
    verifiedOnly: false,
    readyFrom: "",
    sort: "newest",
  };
}
type Filters = ReturnType<typeof makeDefaultFilters>;

function countActiveFilters(f: Filters, defaults: Filters): number {
  let count = 0;
  if (f.search.trim()) count++;
  if (f.breed !== "all") count++;
  if (f.country !== "all") count++;
  if (f.price[0] !== defaults.price[0] || f.price[1] !== defaults.price[1]) count++;
  if (f.availableOnly) count++;
  if (f.applicationsOpenOnly) count++;
  if (f.male) count++;
  if (f.female) count++;
  if (f.transportOnly) count++;
  if (f.verifiedOnly) count++;
  if (f.readyFrom) count++;
  return count;
}

function FindADog() {
  const puppies = Route.useLoaderData();
  const priceBounds = useMemo(() => priceBoundsOf(puppies), [puppies]);
  const defaultFilters = useMemo(() => makeDefaultFilters(priceBounds), [priceBounds]);
  const breedNames = useMemo(() => distinctOptions(puppies, (p) => p.breed), [puppies]);
  const countryNames = useMemo(() => distinctOptions(puppies, (p) => p.country), [puppies]);

  const [view, setView] = useState<"grid" | "list">("grid");
  const [f, setF] = useState<Filters>(defaultFilters);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const activeFilterCount = countActiveFilters(f, defaultFilters);

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

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
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
        <div className="flex w-full max-w-md gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search breed, kennel, city…"
              aria-label="Search breed, kennel, city"
              className="pl-9"
              value={f.search}
              onChange={(e) => update("search", e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            className="shrink-0 lg:hidden"
            onClick={() => setMobileFiltersOpen(true)}
          >
            <SlidersHorizontal className="mr-1 size-4" /> Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 px-1.5">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="hidden rounded-2xl border border-border/70 bg-card p-5 lg:block">
          <FilterControls
            f={f}
            update={update}
            onReset={() => setF(defaultFilters)}
            breedNames={breedNames}
            countryNames={countryNames}
            priceBounds={priceBounds}
          />
        </aside>

        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetContent side="right" className="w-full max-w-sm overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="font-display text-lg">Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <FilterControls
                f={f}
                update={update}
                onReset={() => setF(defaultFilters)}
                breedNames={breedNames}
                countryNames={countryNames}
                priceBounds={priceBounds}
                hideHeader
              />
            </div>
            {/* Lets the user go straight back to the (now-filtered) results instead of having to
                find a small close icon — important on a phone where the sheet covers everything. */}
            <Button className="mt-6 w-full" onClick={() => setMobileFiltersOpen(false)}>
              Show {filtered.length} result{filtered.length === 1 ? "" : "s"}
            </Button>
          </SheetContent>
        </Sheet>

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
                aria-label="Grid view"
                aria-pressed={view === "grid"}
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button
                size="sm"
                variant={view === "list" ? "default" : "ghost"}
                onClick={() => setView("list")}
                aria-label="List view"
                aria-pressed={view === "list"}
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
                {puppies.length === 0
                  ? "No puppies are published yet — check back soon."
                  : "No puppies match your filters — try widening them."}
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

function FilterControls({
  f,
  update,
  onReset,
  breedNames,
  countryNames,
  priceBounds,
  hideHeader,
}: {
  f: Filters;
  update: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  onReset: () => void;
  breedNames: string[];
  countryNames: string[];
  priceBounds: [number, number];
  hideHeader?: boolean;
}) {
  return (
    <>
      {!hideHeader && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <SlidersHorizontal className="size-4" /> Filters
          </h2>
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        </div>
      )}

      <FilterGroup title="Breed">
        <Select value={f.breed} onValueChange={(v) => update("breed", v)}>
          <SelectTrigger aria-label="Breed">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All breeds</SelectItem>
            {breedNames.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterGroup>

      <FilterGroup title="Country">
        <Select value={f.country} onValueChange={(v) => update("country", v)}>
          <SelectTrigger aria-label="Country">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Europe</SelectItem>
            {countryNames.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
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
            <Checkbox checked={f.female} onCheckedChange={(v) => update("female", !!v)} /> Female
          </label>
        </div>
      </FilterGroup>

      <FilterGroup
        title={`Price (PLN) — ${f.price[0].toLocaleString()} – ${f.price[1].toLocaleString()}`}
      >
        <Slider
          value={f.price}
          onValueChange={(v) => update("price", v as [number, number])}
          min={priceBounds[0]}
          max={priceBounds[1]}
          step={100}
          disabled={priceBounds[0] === priceBounds[1]}
          aria-label="Price range in PLN"
        />
      </FilterGroup>

      <FilterGroup title="Collection-ready from">
        <Input
          type="date"
          aria-label="Collection-ready from"
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
    </>
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
