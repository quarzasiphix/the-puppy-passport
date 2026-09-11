import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import {
  getLitterById,
  getLitterParents,
  listPuppiesForLitter,
  PuppyCard,
  formatDate,
  type ParentDogInfo,
} from "@/domains/marketplace";
import { useTranslation } from "@/shared/i18n";
import placeholderImg from "@/assets/puppy-1.jpg";

export const Route = createFileRoute("/_public/litters/$id")({
  loader: async ({ params }) => {
    const litter = await getLitterById(params.id).catch(() => null);
    if (!litter) throw notFound();
    const [parents, puppies] = await Promise.all([
      getLitterParents(litter.id).catch(() => ({ mother: null, father: null })),
      listPuppiesForLitter(litter.id).catch(() => []),
    ]);
    return { litter, parents, puppies };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.litter.code} — ${loaderData.litter.breed} litter — Anemalo`
          : "Litter — Anemalo",
      },
      {
        name: "description",
        content: loaderData
          ? `${loaderData.litter.breed} litter from ${loaderData.litter.kennel}.`
          : "A litter on Anemalo.",
      },
    ],
  }),
  component: LitterDetail,
});

const emptyParent: ParentDogInfo = {
  name: "Not on file",
  pedigree: "",
  image: "",
  tests: [],
  titles: "",
  description: "",
};

const STATUS_STYLES: Record<string, string> = {
  planned: "bg-secondary text-secondary-foreground",
  born: "bg-accent/15 text-accent-foreground border-accent/30",
  ready: "bg-primary/90 text-primary-foreground",
};

function LitterDetail() {
  const { litter, parents, puppies } = Route.useLoaderData();
  const { t, locale } = useTranslation();

  if (!litter) {
    return (
      <div className="container-page py-24 text-center">
        <p className="text-muted-foreground">{t("litterDetail.missingInfo")}</p>
        <Link to="/planned-litters" className="mt-4 inline-block underline">
          {t("litterDetail.backToResults")}
        </Link>
      </div>
    );
  }

  const dateLabel =
    litter.status === "planned" ? t("litterDetail.expectedBirth") : t("litterDetail.born");

  return (
    <div className="container-page py-4 sm:py-6">
      <Link
        to="/planned-litters"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> {t("litterDetail.backToResults")}
      </Link>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="aspect-[21/9] bg-secondary">
          <img
            src={litter.image || placeholderImg}
            alt={litter.code}
            className="size-full object-cover"
          />
        </div>
        <div className="p-5 sm:p-6">
          <Badge className={STATUS_STYLES[litter.status] ?? STATUS_STYLES.planned}>
            {litter.status === "planned"
              ? t("cards.plannedLitter")
              : litter.status === "born"
                ? t("cards.currentLitter")
                : t("litterDetail.statusReady")}
          </Badge>
          <h1 className="mt-3 font-display text-2xl font-medium sm:text-3xl">{litter.breed}</h1>
          <p className="text-muted-foreground">{litter.code}</p>

          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{dateLabel}</dt>
              <dd className="mt-0.5 font-medium">
                {litter.birthDate
                  ? formatDate(locale, litter.birthDate, {})
                  : t("litterDetail.notSetYet")}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("litterDetail.readyDate")}
              </dt>
              <dd className="mt-0.5 font-medium">
                {litter.readyDate
                  ? formatDate(locale, litter.readyDate, {})
                  : t("litterDetail.notSetYet")}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("cards.mother")}
              </dt>
              <dd className="mt-0.5 font-medium">{litter.mother}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("cards.father")}
              </dt>
              <dd className="mt-0.5 font-medium">{litter.father}</dd>
            </div>
          </dl>

          {litter.registration && litter.registration !== "Not registered yet" && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-secondary/50 px-3 py-1 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" />
              {t("litterDetail.registration")}: {litter.registration}
            </div>
          )}

          <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("litterDetail.breederTitle")}
              </div>
              <div className="font-medium">{litter.kennel}</div>
            </div>
            {litter.breederSlug && (
              <Link
                to="/@{$handle}"
                params={{ handle: litter.breederSlug }}
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {t("litterDetail.viewKennelProfile")}
              </Link>
            )}
          </div>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-4 font-display text-xl font-semibold">
          {t("litterDetail.parentsTitle")}
        </h2>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <ParentCard p={parents.mother ?? emptyParent} label={t("cards.mother")} />
          <ParentCard p={parents.father ?? emptyParent} label={t("cards.father")} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 font-display text-xl font-semibold">
          {t("litterDetail.puppiesTitle")}
        </h2>
        {puppies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
            <p className="text-sm text-muted-foreground">{t("litterDetail.noPuppiesYet")}</p>
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {puppies.map((p) => (
              <PuppyCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ParentCard({ p, label }: { p: ParentDogInfo; label: string }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <img
        src={p.image || placeholderImg}
        alt={p.name}
        className="aspect-[4/3] w-full object-cover"
      />
      <div className="p-5">
        <div className="text-xs uppercase tracking-wide text-accent">{label}</div>
        <h4 className="mt-1 font-display text-lg font-semibold">
          {p.name === "Not on file" ? t("litterDetail.notOnFile") : p.name}
        </h4>
        <p className="text-xs text-muted-foreground">{p.pedigree}</p>
        {p.description && <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>}
        {p.tests.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.tests.map((tst) => (
              <Badge key={tst} variant="secondary">
                {tst}
              </Badge>
            ))}
          </div>
        )}
        {p.titles && (
          <p className="mt-3 text-sm">
            <strong>{p.titles}</strong>
          </p>
        )}
      </div>
    </div>
  );
}
