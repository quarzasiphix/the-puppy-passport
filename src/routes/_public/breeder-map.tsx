import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { listApprovedKennels } from "@/domains/marketplace";
import { BreederCard } from "@/domains/marketplace";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/_public/breeder-map")({
  loader: () => listApprovedKennels(),
  head: () => ({
    meta: [
      { title: "Breeder directory — Anemalo" },
      {
        name: "description",
        content: "Browse verified breeders by country and city across Europe.",
      },
    ],
  }),
  component: BreederMapPage,
});

// Free-text city/country values from different kennels' own registration forms can differ only in
// case or diacritics ("Łódź" vs "lodz", "Poland" vs "poland") while clearly meaning the same place
// — grouping on the raw string then split those into separate, half-empty sections. This folds
// case and diacritics only (not a full transliteration/canonicalization library, and it can't
// merge genuinely different words for the same place, e.g. "Poland" vs "POLSKA" written in a
// different language — that would need a real country-name dictionary, out of scope here).
function normalizeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "");
}

function BreederMapPage() {
  const breeders = Route.useLoaderData();
  const { t } = useTranslation();
  const [country, setCountry] = useState<string | null>(null);

  const countries = useMemo(() => {
    // Keyed by normalized form, displaying the first original-cased spelling seen for it, so two
    // kennels writing "Poland"/"poland" land in one group instead of two.
    const counts = new Map<string, { label: string; count: number }>();
    for (const b of breeders) {
      if (!b.country) continue;
      const key = normalizeKey(b.country);
      const entry = counts.get(key) ?? { label: b.country, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
    return Array.from(counts.entries())
      .map(([key, { label, count }]) => [key, label, count] as const)
      .sort((a, b) => b[2] - a[2]);
  }, [breeders]);

  const filtered = country
    ? breeders.filter((b) => b.country && normalizeKey(b.country) === country)
    : breeders;

  const byCity = useMemo(() => {
    const groups = new Map<string, { label: string; kennels: typeof breeders }>();
    for (const b of filtered) {
      const key = b.city ? normalizeKey(b.city) : "";
      const label = b.city || t("breederMap.unknownCity");
      const entry = groups.get(key) ?? { label, kennels: [] };
      entry.kennels.push(b);
      groups.set(key, entry);
    }
    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, t]);

  return (
    <div className="container-page py-10">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">
          {t("breederMap.eyebrow")}
        </p>
        <h1 className="mt-2 font-display text-3xl font-medium">{t("breederMap.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("breederMap.desc")}</p>
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
            {t("breederMap.allCountries")} ({breeders.length})
          </button>
          {countries.map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setCountry(key)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                country === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      )}

      {breeders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <MapPin className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">{t("breederMap.noneTitle")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {t("breederMap.noneDesc")}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {byCity.map(({ label, kennels }) => (
            <section key={label}>
              <div className="mb-3 flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                <h2 className="font-display text-lg font-semibold">{label}</h2>
                <Badge variant="secondary">{kennels.length}</Badge>
              </div>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
