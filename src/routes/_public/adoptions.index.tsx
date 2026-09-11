import { createFileRoute, Link } from "@tanstack/react-router";
import { HeartHandshake } from "lucide-react";
import { listPublishedAdoptions } from "@/domains/marketplace";
import { AdoptionCard } from "@/domains/marketplace";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/_public/adoptions/")({
  loader: () => listPublishedAdoptions(),
  head: () => ({
    meta: [
      { title: "Dogs for adoption — Anemalo" },
      {
        name: "description",
        content: "Browse dogs looking for a new home from verified foundations and private owners.",
      },
    ],
  }),
  component: AdoptionsPage,
});

function AdoptionsPage() {
  const animals = Route.useLoaderData();
  const { t } = useTranslation();
  const heading = animals.length
    ? `${t("adoptionsPage.headingLabel")}: ${animals.length} — ${t("adoptionsPage.fallbackDesc")}`
    : t("adoptionsPage.fallbackDesc");
  return (
    <div className="container-page py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">{t("adoptionsPage.title")}</h1>
          <p className="text-sm text-muted-foreground">{heading}</p>
        </div>
        <Link to="/rehome" className="text-sm text-primary hover:underline">
          {t("adoptionsPage.rehomeLink")}
        </Link>
      </header>

      {animals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <HeartHandshake className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">{t("adoptionsPage.noneTitle")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {t("adoptionsPage.noneDesc")}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {animals.map((a) => (
            <AdoptionCard key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}
