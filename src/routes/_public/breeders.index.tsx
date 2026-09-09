import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { listApprovedKennels } from "@/domains/marketplace";
import { BreederCard } from "@/domains/marketplace";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Search, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/_public/breeders/")({
  loader: () => listApprovedKennels(),
  head: () => ({ meta: [{ title: "Verified breeders — Anemalo" }] }),
  component: BreedersList,
});

const ALL = "__all__";

// Breeder discovery is a real, standalone browsing experience — you can look for a kennel even if
// they have no puppies listed right now (the redesign brief is explicit this isn't just "a seller
// list attached to the marketplace"). Filtering is client-side over the already-loaded, small
// approved-kennel list (see DEFAULT_PAGE_SIZE's own reasoning in marketplace.ts for why that's a
// safe assumption today) — a real server-side search is a reasonable next step once the kennel
// count grows past what's comfortable to ship in one payload.
function BreedersList() {
  const breeders = Route.useLoaderData();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [breed, setBreed] = useState(ALL);
  const [country, setCountry] = useState(ALL);
  const [puppiesOnly, setPuppiesOnly] = useState(false);

  const breeds = useMemo(
    () => Array.from(new Set(breeders.flatMap((b) => b.breeds))).sort(),
    [breeders],
  );
  const countries = useMemo(
    () => Array.from(new Set(breeders.map((b) => b.country).filter(Boolean))).sort(),
    [breeders],
  );

  const filtered = breeders.filter((b) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matches =
        b.kennel.toLowerCase().includes(q) ||
        b.city.toLowerCase().includes(q) ||
        b.breeds.some((br) => br.toLowerCase().includes(q));
      if (!matches) return false;
    }
    if (breed !== ALL && !b.breeds.includes(breed)) return false;
    if (country !== ALL && b.country !== country) return false;
    if (puppiesOnly && b.availablePuppies === 0) return false;
    return true;
  });

  return (
    <div className="container-page py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-accent">
            {t("breedersPage.eyebrow")}
          </p>
          <h1 className="mt-1 font-display text-4xl font-medium">{t("breedersPage.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("breedersPage.subtitle")}</p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("breedersPage.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-3">
        <span className="inline-flex items-center gap-1.5 pl-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <SlidersHorizontal className="size-3.5" /> {t("breedersPage.filter")}
        </span>
        <Select value={breed} onValueChange={setBreed}>
          <SelectTrigger className="w-44 bg-background">
            <SelectValue placeholder={t("breedersPage.breedPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("breedersPage.allBreeds")}</SelectItem>
            {breeds.map((br) => (
              <SelectItem key={br} value={br}>
                {br}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-44 bg-background">
            <SelectValue placeholder={t("breedersPage.countryPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("breedersPage.allCountries")}</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={puppiesOnly ? "default" : "outline"}
          className={puppiesOnly ? "" : "bg-background"}
          onClick={() => setPuppiesOnly((v) => !v)}
        >
          {t("breedersPage.puppiesAvailableNow")}
        </Button>
        {(search || breed !== ALL || country !== ALL || puppiesOnly) && (
          <Button
            variant="ghost"
            className="ml-auto"
            onClick={() => {
              setSearch("");
              setBreed(ALL);
              setCountry(ALL);
              setPuppiesOnly(false);
            }}
          >
            {t("breedersPage.clearFilters")}
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {breeders.length === 0 ? t("breedersPage.noneYet") : t("breedersPage.noMatch")}
          </p>
        </div>
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
