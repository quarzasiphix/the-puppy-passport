import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Dog as DogIcon, Plus, BadgeCheck } from "lucide-react";

import { searchDogs, type DogSearchResult } from "@/domains/pedigrees";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/_public/pedigrees")({
  head: () => ({
    meta: [
      { title: "Pedigree registry — Anemalo" },
      {
        name: "description",
        content:
          "Search the Anemalo public pedigree registry by registered name, registration number, kennel or breed.",
      },
    ],
  }),
  component: PedigreeSearch,
});

function ResultRow({ dog }: { dog: DogSearchResult }) {
  const { t } = useTranslation();
  const exact = dog.matchedOn.includes("pedigree_number") || dog.matchedOn.includes("microchip");
  return (
    <Link
      to="/dogs/$slug"
      params={{ slug: dog.slug ?? dog.id }}
      className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors hover:border-accent ${
        exact ? "border-success/40 bg-success/5" : "border-border/70 bg-card"
      }`}
    >
      <div className="grid size-12 flex-none place-items-center overflow-hidden rounded-xl border border-border/60 bg-secondary">
        {dog.profileImageUrl ? (
          <img
            src={dog.profileImageUrl}
            alt={dog.registeredName}
            className="size-full object-cover"
          />
        ) : (
          <DogIcon className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{dog.registeredName}</div>
        <div className="truncate text-xs text-muted-foreground">
          {[dog.pedigreeNumber, dog.kennelName].filter(Boolean).join(" · ") || "—"}
        </div>
      </div>
      {exact && (
        <span className="inline-flex flex-none items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
          <BadgeCheck className="size-3" /> {t("pedigree.search.exactMatch")}
        </span>
      )}
    </Link>
  );
}

function PedigreeSearch() {
  const { t } = useTranslation();
  const [term, setTerm] = useState("");
  const trimmed = term.trim();

  const query = useQuery({
    queryKey: ["dog-search", trimmed],
    enabled: trimmed.length >= 2,
    queryFn: () => searchDogs(trimmed, 30),
    staleTime: 15_000,
  });

  const results = query.data ?? [];

  return (
    <div className="container-page py-10">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">
          {t("pedigree.search.eyebrow")}
        </p>
        <h1 className="mt-1 font-display text-4xl font-medium">{t("pedigree.search.title")}</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">{t("pedigree.search.subtitle")}</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            className="pl-9"
            placeholder={t("pedigree.search.placeholder")}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        <Button asChild variant="outline">
          <Link to="/pedigrees/add">
            <Plus className="mr-1.5 size-4" /> {t("pedigree.search.addPedigree")}
          </Link>
        </Button>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">{t("pedigree.search.regNumberHint")}</p>

      <div className="mt-6 space-y-2">
        {trimmed.length < 2 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center text-sm text-muted-foreground">
            {t("pedigree.search.startTyping")}
          </div>
        ) : query.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("pedigree.search.searching")}</p>
        ) : query.isError ? (
          <p className="text-sm text-destructive">{t("pedigree.search.error")}</p>
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
            <p className="text-sm text-muted-foreground">{t("pedigree.search.noResults")}</p>
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link to="/pedigrees/add">{t("pedigree.search.addInstead")}</Link>
            </Button>
          </div>
        ) : (
          results.map((dog) => <ResultRow key={dog.id} dog={dog} />)
        )}
      </div>
    </div>
  );
}
