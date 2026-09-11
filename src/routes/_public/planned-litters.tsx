import { createFileRoute } from "@tanstack/react-router";
import { listPublishedLitters } from "@/domains/marketplace";
import { LitterCard } from "@/domains/marketplace";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/_public/planned-litters")({
  loader: () => listPublishedLitters("planned"),
  head: () => ({ meta: [{ title: "Planned litters — Anemalo" }] }),
  component: PlannedLittersPage,
});

function PlannedLittersPage() {
  const plannedLitters = Route.useLoaderData();
  const { t } = useTranslation();
  return (
    <div className="container-page py-10">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">
          {t("plannedLittersPage.eyebrow")}
        </p>
        <h1 className="mt-1 font-display text-4xl font-medium">
          {t("plannedLittersPage.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("plannedLittersPage.desc")}</p>
      </header>
      {plannedLitters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">{t("plannedLittersPage.none")}</p>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {plannedLitters.map((l) => (
            <LitterCard key={l.id} l={l} planned />
          ))}
        </div>
      )}
    </div>
  );
}
