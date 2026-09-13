import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, SlidersHorizontal, ShieldCheck } from "lucide-react";
import { listApprovedTransportCompanies, formatLocation } from "@/domains/marketplace";
import type { Breeder } from "@/lib/mock-data";
import { VerifiedBadge } from "@/domains/breeders";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { useTranslation } from "@/shared/i18n";

// A verified transporter directory, mirroring foundations.tsx exactly (client-side filtering over
// an already-small, already-loaded approved-org list) — listApprovedTransportCompanies() is a
// one-line variant of listApprovedFoundations() (org_type = 'transport_company' instead of
// foundation/shelter/rescue), reusing the same buildBreeder() mapping.
export const Route = createFileRoute("/_public/transport-companies")({
  loader: () => listApprovedTransportCompanies(),
  head: () => ({
    meta: [
      { title: "Verified transport companies — Anemalo" },
      {
        name: "description",
        content: "Verified animal transport companies on Anemalo.",
      },
    ],
  }),
  component: TransportCompaniesList,
});

const ALL = "__all__";

function TransportCompaniesList() {
  const companies = Route.useLoaderData();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState(ALL);

  const countries = useMemo(
    () => Array.from(new Set(companies.map((c) => c.country).filter(Boolean))).sort(),
    [companies],
  );

  const filtered = companies.filter((c) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!c.kennel.toLowerCase().includes(q) && !c.city.toLowerCase().includes(q)) return false;
    }
    if (country !== ALL && c.country !== country) return false;
    return true;
  });

  return (
    <div className="container-page py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-accent">
            {t("transportCompaniesPage.eyebrow")}
          </p>
          <h1 className="mt-1 font-display text-3xl font-medium sm:text-4xl">
            {t("transportCompaniesPage.title")}
          </h1>
          <p className="mt-1 text-muted-foreground">{t("transportCompaniesPage.subtitle")}</p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("transportCompaniesPage.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-3">
        <span className="inline-flex items-center gap-1.5 pl-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <SlidersHorizontal className="size-3.5" /> {t("transportCompaniesPage.filter")}
        </span>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-44 bg-background">
            <SelectValue placeholder={t("transportCompaniesPage.countryPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("transportCompaniesPage.allCountries")}</SelectItem>
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
            {t("transportCompaniesPage.clearFilters")}
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {companies.length === 0
              ? t("transportCompaniesPage.noneYet")
              : t("transportCompaniesPage.noMatch")}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <TransportCompanyCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function TransportCompanyCard({ c }: { c: Breeder }) {
  const { t } = useTranslation();
  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card">
      <Link
        to="/@{$handle}"
        params={{ handle: c.slug }}
        className="absolute inset-0 z-0"
        tabIndex={-1}
        aria-hidden="true"
      />
      <div className="relative aspect-[16/9] overflow-hidden bg-secondary">
        <img src={c.cover} alt={c.kennel} loading="lazy" className="size-full object-cover" />
        {c.verified && (
          <VerifiedBadge accentColor={c.accentColor} className="absolute right-3 top-3">
            <ShieldCheck className="size-3" /> {t("cards.verified")}
          </VerifiedBadge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="font-display text-lg font-semibold">{c.kennel}</h3>
        <p className="text-sm text-muted-foreground">{formatLocation(c.city, c.country)}</p>
        <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
        <Button asChild variant="outline" className="relative mt-auto">
          <Link to="/@{$handle}" params={{ handle: c.slug }}>
            {t("cards.viewProfile")}
          </Link>
        </Button>
      </div>
    </article>
  );
}
