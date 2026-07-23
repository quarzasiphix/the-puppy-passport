import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { listApprovedFoundations } from "@/lib/queries/marketplace";
import { FoundationCard } from "@/components/cards";
import { pluralCategory, useTranslation } from "@/lib/i18n";
import { EmptyState } from "@/components/public/empty-state";

export const Route = createFileRoute("/_public/foundations")({
  loader: () => listApprovedFoundations(),
  head: () => ({
    meta: [
      { title: "Foundations and rescues — Havenpaw" },
      {
        name: "description",
        content:
          "Browse verified foundations, shelters and rescues offering dogs for adoption across Europe.",
      },
    ],
  }),
  component: FoundationsPage,
});

const countSuffixKey = {
  one: "countSuffixOne",
  few: "countSuffixFew",
  many: "countSuffixMany",
} as const;

function FoundationsPage() {
  const foundations = Route.useLoaderData();
  const { t, locale } = useTranslation();
  const count = foundations.length;
  return (
    <div className="container-page py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">{t("foundations.pageTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {count > 0 && `${count} `}
            {count === 0
              ? t("foundations.countSuffixEmpty")
              : t(`foundations.${countSuffixKey[pluralCategory(locale, count)]}`)}
          </p>
        </div>
        <Link to="/adoptions" className="text-sm text-primary hover:underline">
          {t("foundations.browseAdoptionsInstead")}
        </Link>
      </header>

      {foundations.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={t("foundations.emptyTitle")}
          description={t("foundations.emptyDesc")}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {foundations.map((f) => (
            <FoundationCard key={f.id} f={f} />
          ))}
        </div>
      )}
    </div>
  );
}
