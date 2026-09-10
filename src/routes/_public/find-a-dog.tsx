import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  Map,
  LayoutGrid,
  List,
  MapPin,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Checkbox } from "@/shared/ui/checkbox";
import { Slider } from "@/shared/ui/slider";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Separator } from "@/shared/ui/separator";
import { Badge } from "@/shared/ui/badge";
import { listPublishedPuppies } from "@/domains/marketplace";
import { PuppyCard } from "@/domains/marketplace";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/_public/find-a-dog")({
  loader: () => listPublishedPuppies(),
  head: () => ({
    meta: [
      { title: "Find a dog — Anemalo" },
      { name: "description", content: "Browse puppies from verified European breeders." },
    ],
  }),
  component: FindADog,
});

// Breed/country filter values stay the raw English strings stored on the animal row (the DB isn't
// localized) — only the displayed label is translated, via getBreedOptions/getCountryOptions below.
function getBreedOptions(t: (key: string) => string) {
  return [
    ["all", t("findADog.breedAll")],
    ["Golden Retriever", t("findADog.breeds.goldenRetriever")],
    ["Border Collie", t("findADog.breeds.borderCollie")],
    ["Labrador Retriever", t("findADog.breeds.labradorRetriever")],
    ["German Shepherd", t("findADog.breeds.germanShepherd")],
    ["Bernese Mountain Dog", t("findADog.breeds.bernese")],
    ["French Bulldog", t("findADog.breeds.frenchBulldog")],
  ] as const;
}

function getCountryOptions(t: (key: string) => string) {
  return [
    ["all", t("findADog.countryAll")],
    ["Poland", t("findADog.countries.poland")],
    ["Germany", t("findADog.countries.germany")],
    ["Netherlands", t("findADog.countries.netherlands")],
    ["Czech Republic", t("findADog.countries.czechRepublic")],
  ] as const;
}

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
  const { t, locale } = useTranslation();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [f, setF] = useState(defaultFilters);
  const breedOptions = getBreedOptions(t);
  const countryOptions = getCountryOptions(t);

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
          <h1 className="font-display text-3xl font-medium">{t("findADog.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("findADog.showingPrefix")} {filtered.length} {t("findADog.showingMiddle")}{" "}
            {puppies.length} {t("findADog.showingSuffix")} ·{" "}
            <Link to="/find-your-dog" className="text-primary hover:underline">
              {t("findADog.guidedSearchLink")}
            </Link>
          </p>
        </div>
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("findADog.searchPlaceholder")}
            className="pl-9"
            value={f.search}
            onChange={(e) => update("search", e.target.value)}
          />
        </div>
      </header>

      {/* On mobile the full filter panel would push every result below the fold, so it collapses
          behind this toggle; on lg it's always the left rail. */}
      <button
        type="button"
        onClick={() => setFiltersOpen((v) => !v)}
        className="mb-4 flex w-full items-center justify-between rounded-xl border border-border/70 bg-card px-4 py-3 text-sm font-medium lg:hidden"
        aria-expanded={filtersOpen}
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="size-4" /> {t("findADog.filters")}
        </span>
        <ChevronDown className={`size-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
      </button>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside
          className={`rounded-2xl border border-border/70 bg-card p-5 ${filtersOpen ? "block" : "hidden"} lg:block`}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <SlidersHorizontal className="size-4" /> {t("findADog.filters")}
            </h2>
            <button
              type="button"
              onClick={() => setF(defaultFilters)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t("findADog.reset")}
            </button>
          </div>

          <FilterGroup title={t("findADog.breedLabel")}>
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

          <FilterGroup title={t("findADog.countryLabel")}>
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

          <FilterGroup title={t("findADog.availabilityLabel")}>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={f.availableOnly}
                  onCheckedChange={(v) => update("availableOnly", !!v)}
                />{" "}
                {t("findADog.availableNow")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={f.applicationsOpenOnly}
                  onCheckedChange={(v) => update("applicationsOpenOnly", !!v)}
                />{" "}
                {t("findADog.applicationsOpen")}
              </label>
            </div>
          </FilterGroup>

          <FilterGroup title={t("findADog.sexLabel")}>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={f.male} onCheckedChange={(v) => update("male", !!v)} />{" "}
                {t("findADog.male")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={f.female} onCheckedChange={(v) => update("female", !!v)} />{" "}
                {t("findADog.female")}
              </label>
            </div>
          </FilterGroup>

          <FilterGroup
            title={`${t("findADog.priceLabel")} — ${f.price[0].toLocaleString()} – ${f.price[1].toLocaleString()}`}
          >
            <Slider
              value={f.price}
              onValueChange={(v) => update("price", v as [number, number])}
              min={1000}
              max={20000}
              step={100}
            />
          </FilterGroup>

          <FilterGroup title={t("findADog.readyFromLabel")}>
            <Input
              type="date"
              value={f.readyFrom}
              onChange={(e) => update("readyFrom", e.target.value)}
            />
          </FilterGroup>

          <FilterGroup title={t("findADog.verificationTransportLabel")}>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={f.verifiedOnly}
                  onCheckedChange={(v) => update("verifiedOnly", !!v)}
                />{" "}
                {t("findADog.verifiedBreedersOnly")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={f.transportOnly}
                  onCheckedChange={(v) => update("transportOnly", !!v)}
                />{" "}
                {t("findADog.transportAvailableFilter")}
              </label>
            </div>
          </FilterGroup>
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3">
            <div className="text-sm text-muted-foreground">
              <strong className="text-foreground">{filtered.length}</strong> {t("findADog.results")}
            </div>
            <div className="flex items-center gap-2">
              <Select value={f.sort} onValueChange={(v) => update("sort", v)}>
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t("findADog.sortNewest")}</SelectItem>
                  <SelectItem value="ready">{t("findADog.sortReady")}</SelectItem>
                  <SelectItem value="price">{t("findADog.sortPrice")}</SelectItem>
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
                  <Map className="mr-1 size-4" /> {t("findADog.mapView")}
                </Link>
              </Button>
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
              <p className="text-sm text-muted-foreground">{t("findADog.noResults")}</p>
              {puppies.length > 0 && (
                <Button variant="outline" className="mt-4" onClick={() => setF(defaultFilters)}>
                  {t("findADog.clearFilters")}
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
                        <Calendar className="size-3" /> {t("cards.readyPrefix")}{" "}
                        {new Date(p.readyDate).toLocaleDateString(
                          locale === "pl" ? "pl-PL" : "en-GB",
                        )}
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
                    <Button size="sm">{t("cards.viewPuppy")}</Button>
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
