import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, SlidersHorizontal, ShieldCheck } from "lucide-react";
import { listApprovedFoundations, formatLocation } from "@/domains/marketplace";
import type { Breeder } from "@/lib/mock-data";
import { VerifiedBadge } from "@/domains/breeders";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { useTranslation } from "@/shared/i18n";

// Was a hardcoded placeholder ("Public foundation profiles are coming to Anemalo as part of a
// later build phase") despite real, approved foundation/shelter/rescue organisations already
// existing in the same `organisations` table the breeders directory reads from — see
// listApprovedFoundations()'s own comment. This mirrors breeders.index.tsx's shape (client-side
// filtering over an already-small, already-loaded approved-org list).
export const Route = createFileRoute("/_public/foundations")({
  loader: () => listApprovedFoundations(),
  head: () => ({
    meta: [
      { title: "Foundations and rescues — Anemalo" },
      {
        name: "description",
        content: "Verified foundations, shelters and rescues on Anemalo.",
      },
    ],
  }),
  component: FoundationsList,
});

const ALL = "__all__";

function FoundationsList() {
  const foundations = Route.useLoaderData();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState(ALL);

  const countries = useMemo(
    () => Array.from(new Set(foundations.map((f) => f.country).filter(Boolean))).sort(),
    [foundations],
  );

  const filtered = foundations.filter((f) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!f.kennel.toLowerCase().includes(q) && !f.city.toLowerCase().includes(q)) return false;
    }
    if (country !== ALL && f.country !== country) return false;
    return true;
  });

  return (
    <div className="container-page py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-accent">
            {t("foundationsPage.eyebrow")}
          </p>
          <h1 className="mt-1 font-display text-3xl font-medium sm:text-4xl">
            {t("foundationsPage.title")}
          </h1>
          <p className="mt-1 text-muted-foreground">{t("foundationsPage.subtitle")}</p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("foundationsPage.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-3">
        <span className="inline-flex items-center gap-1.5 pl-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <SlidersHorizontal className="size-3.5" /> {t("foundationsPage.filter")}
        </span>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-44 bg-background">
            <SelectValue placeholder={t("foundationsPage.countryPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("foundationsPage.allCountries")}</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || country !== ALL) && (
          <Button
            variant="ghost"
            className="ml-auto"
            onClick={() => {
              setSearch("");
              setCountry(ALL);
            }}
          >
            {t("foundationsPage.clearFilters")}
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {foundations.length === 0 ? t("foundationsPage.noneYet") : t("foundationsPage.noMatch")}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => (
            <FoundationCard key={f.id} f={f} />
          ))}
        </div>
      )}
    </div>
  );
}

function FoundationCard({ f }: { f: Breeder }) {
  const { t } = useTranslation();
  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card">
      <Link
        to="/@{$handle}"
        params={{ handle: f.slug }}
        className="absolute inset-0 z-0"
        tabIndex={-1}
        aria-hidden="true"
      />
      <div className="relative aspect-[16/9] overflow-hidden bg-secondary">
        <img src={f.cover} alt={f.kennel} loading="lazy" className="size-full object-cover" />
        {f.verified && (
          <VerifiedBadge accentColor={f.accentColor} className="absolute right-3 top-3">
            <ShieldCheck className="size-3" /> {t("cards.verified")}
          </VerifiedBadge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="font-display text-lg font-semibold">{f.kennel}</h3>
        <p className="text-sm text-muted-foreground">{formatLocation(f.city, f.country)}</p>
        <p className="line-clamp-2 text-sm text-muted-foreground">{f.description}</p>
        {f.availablePuppies > 0 && (
          <p className="text-sm font-medium text-accent">
            {f.availablePuppies} {t("foundationsPage.animalsAvailable")}
          </p>
        )}
        <Button asChild variant="outline" className="relative mt-auto">
          <Link to="/@{$handle}" params={{ handle: f.slug }}>
            {t("cards.viewProfile")}
          </Link>
        </Button>
      </div>
    </article>
  );
}
