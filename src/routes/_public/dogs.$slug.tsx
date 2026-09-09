import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Dog as DogIcon, Flag, PawPrint } from "lucide-react";

import {
  getDogBySlug,
  getDogEvidenceSummary,
  getAncestorTree,
  computeTreeCompleteness,
  createDogClaim,
  type AncestorTree,
  type DogEvidenceSummary,
  type DogIdentity,
} from "@/domains/pedigrees";
import { useAuth } from "@/domains/identity";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import { useTranslation } from "@/shared/i18n";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";

import { EvidenceBadges } from "./-components/pedigree/evidence-badges";
import { AncestorTreeView } from "./-components/pedigree/ancestor-tree";

const TREE_GENERATIONS = 5;

type LoaderData = {
  dog: DogIdentity;
  evidence: DogEvidenceSummary;
  tree: AncestorTree;
};

export const Route = createFileRoute("/_public/dogs/$slug")({
  loader: async ({ params }): Promise<LoaderData> => {
    const dog = await getDogBySlug(params.slug).catch(() => null);
    if (!dog) throw notFound();
    const [evidence, tree] = await Promise.all([
      getDogEvidenceSummary(dog.id).catch((): DogEvidenceSummary => ({
        hasPedigreeDocument: false,
        parentRelationshipSupportedBySource: false,
        registryVerified: false,
        dnaVerified: false,
        hasDisputedRelationship: false,
      })),
      getAncestorTree(dog.id, dog, TREE_GENERATIONS).catch((): AncestorTree => ({
        root: dog,
        generations: TREE_GENERATIONS,
        sire: null,
        dam: null,
      })),
    ]);
    return { dog, evidence, tree };
  },
  head: ({ loaderData }) => {
    const dog = loaderData?.dog;
    const title = dog ? `${dog.registeredName} — Pedigree — Anemalo` : "Dog — Anemalo";
    const bits = dog
      ? [dog.breedName, dog.sex, dog.pedigreeNumber ? `Reg. ${dog.pedigreeNumber}` : null]
          .filter(Boolean)
          .join(" · ")
      : "";
    return {
      meta: [
        { title },
        {
          name: "description",
          content: dog
            ? `${dog.registeredName}${bits ? ` — ${bits}` : ""}. Ancestry, evidence and kennel on the Anemalo public pedigree registry.`
            : "A dog on the Anemalo public pedigree registry.",
        },
        ...(dog?.slug
          ? [
              {
                tag: "link",
                attrs: { rel: "canonical", href: `/dogs/${dog.slug}` },
              } as const,
            ]
          : []),
      ],
    };
  },
  component: DogPage,
});

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function ClaimDogCard({ dog }: { dog: DogIdentity }) {
  const { t } = useTranslation();
  const { userId, isSignedIn } = useAuth();
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  const claim = useMutation({
    mutationFn: async (claimType: "owner" | "breeder") => {
      if (!userId) throw new Error(t("pedigree.claim.signInFirst"));
      await createDogClaim({
        dogId: dog.id,
        claimantProfileId: userId,
        claimType,
        organisationId: null,
        message: message.trim() || null,
      });
    },
    onSuccess: () => {
      setDone(true);
      toast.success(t("pedigree.claim.submitted"));
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, t("pedigree.claim.failed"))),
  });

  if (done) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-sm text-foreground">
        {t("pedigree.claim.submittedDetail")}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4">
      <h3 className="font-display text-lg font-semibold">{t("pedigree.claim.title")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t("pedigree.claim.blurb")}</p>
      {isSignedIn ? (
        <>
          <textarea
            className="mt-3 w-full rounded-lg border border-border bg-background p-2 text-sm"
            rows={2}
            placeholder={t("pedigree.claim.messagePlaceholder")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={claim.isPending}
              onClick={() => claim.mutate("owner")}
            >
              {t("pedigree.claim.asOwner")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={claim.isPending}
              onClick={() => claim.mutate("breeder")}
            >
              {t("pedigree.claim.asBreeder")}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{t("pedigree.claim.reviewNote")}</p>
        </>
      ) : (
        <Button size="sm" variant="outline" className="mt-3" asChild>
          <Link to="/signin">{t("pedigree.claim.signInFirst")}</Link>
        </Button>
      )}
    </div>
  );
}

function DogPage() {
  const { dog, evidence, tree } = Route.useLoaderData();
  const { t } = useTranslation();
  const { isSignedIn } = useAuth();
  const [tab, setTab] = useState("overview");

  const completeness = computeTreeCompleteness(tree);

  return (
    <div className="container-page py-8">
      <Link
        to="/pedigrees"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> {t("pedigree.search.backToSearch")}
      </Link>

      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="grid size-20 flex-none place-items-center overflow-hidden rounded-2xl border border-border/70 bg-secondary">
            {dog.profileImageUrl ? (
              <img
                src={dog.profileImageUrl}
                alt={dog.registeredName}
                className="size-full object-cover"
              />
            ) : (
              <DogIcon className="size-8 text-muted-foreground" />
            )}
          </div>
          <div>
            <h1 className="font-display text-3xl font-medium">{dog.registeredName}</h1>
            <p className="text-sm text-muted-foreground">
              {[
                dog.callName ? `"${dog.callName}"` : null,
                dog.breedName,
                dog.sex ? t(`pedigree.sex.${dog.sex}`) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {dog.lifeStatus === "deceased" && (
              <Badge variant="outline" className="mt-1">
                {t("pedigree.lifeStatus.deceased")}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <div className="mt-4">
        <EvidenceBadges evidence={evidence} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">{t("pedigree.tabs.overview")}</TabsTrigger>
          <TabsTrigger value="pedigree">
            {t("pedigree.tabs.pedigree")}
            <span className="ml-1.5 text-xs text-muted-foreground">
              {completeness.filled}/{completeness.total}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label={t("pedigree.fields.registeredName")} value={dog.registeredName} />
                <Field label={t("pedigree.fields.callName")} value={dog.callName} />
                <Field
                  label={t("pedigree.fields.sex")}
                  value={dog.sex ? t(`pedigree.sex.${dog.sex}`) : null}
                />
                <Field label={t("pedigree.fields.breed")} value={dog.breedName} />
                <Field label={t("pedigree.fields.dob")} value={dog.dateOfBirth} />
                <Field label={t("pedigree.fields.color")} value={dog.color} />
                <Field label={t("pedigree.fields.registrationNumber")} value={dog.pedigreeNumber} />
                <Field label={t("pedigree.fields.microchip")} value={dog.microchipNumber} />
                <Field label={t("pedigree.fields.country")} value={dog.countryOfOrigin} />
                <Field label={t("pedigree.fields.titles")} value={dog.titles} />
                <Field label={t("pedigree.fields.kennel")} value={dog.kennelName} />
              </dl>
              {dog.kennelSlug && (
                <Link
                  to="/@$handle"
                  params={{ handle: dog.kennelSlug }}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                >
                  <PawPrint className="size-4" /> {t("pedigree.fields.viewKennel")}
                </Link>
              )}
              {dog.description && (
                <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">
                  {dog.description}
                </p>
              )}
              <p className="mt-5 rounded-lg bg-secondary/50 p-3 text-[11px] text-muted-foreground">
                <Flag className="mr-1 inline size-3" />
                {t("pedigree.overview.provenanceNote")}
              </p>
            </div>

            <ClaimDogCard dog={dog} />
          </div>
        </TabsContent>

        <TabsContent value="pedigree" className="mt-4">
          <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
            {tree.sire || tree.dam ? (
              <AncestorTreeView tree={tree} canContribute={isSignedIn} />
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
                <p className="text-sm text-muted-foreground">{t("pedigree.tree.noneYet")}</p>
                {isSignedIn && (
                  <Button size="sm" variant="outline" className="mt-3" asChild>
                    <Link to="/pedigrees/add" search={{ subject: dog.slug ?? dog.id }}>
                      {t("pedigree.tree.addPedigree")}
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
