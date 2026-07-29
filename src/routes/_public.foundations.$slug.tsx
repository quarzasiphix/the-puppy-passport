import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Truck, MapPin, Heart, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getFoundationBySlug, listPublishedAdoptionsForOrg } from "@/lib/queries/marketplace";
import { AdoptionCard } from "@/components/cards";
import { ReportDialog } from "@/components/report-dialog";
import { useAuth } from "@/hooks/use-auth";
import { followOrg, listFollowedOrgIds, unfollowOrg } from "@/lib/queries/buyer-activity";
import { listPublicPostsByOrg } from "@/lib/queries/profile";
import { useTranslation } from "@/lib/i18n";
import { formatDate } from "@/lib/presentation/date";
import { AnimalImage } from "@/components/marketplace/animal-image";

export const Route = createFileRoute("/_public/foundations/$slug")({
  loader: async ({ params }) => {
    // getFoundationBySlug only returns null for a genuine "no such public foundation" — a real
    // query failure throws and is left to propagate to the root error boundary instead of being
    // coerced into the same 404 as a real absence (see the function's own doc comment).
    const f = await getFoundationBySlug(params.slug);
    if (!f) throw notFound();
    const [animals, posts] = await Promise.all([
      listPublishedAdoptionsForOrg(f.id),
      listPublicPostsByOrg(f.id),
    ]);
    return { f, animals, posts };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.f.name} — Havenpaw` : "Foundation — Havenpaw" },
      {
        name: "description",
        content: loaderData
          ? `${loaderData.f.name} in ${loaderData.f.city}, ${loaderData.f.country} — a verified foundation on Havenpaw.`
          : "A foundation profile on Havenpaw.",
      },
    ],
  }),
  component: FoundationProfile,
});

function FoundationProfile() {
  const { f, animals, posts } = Route.useLoaderData();
  const { userId, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const { t, locale } = useTranslation();
  const [tab, setTab] = useState("about");
  const orgTypeLabel = {
    foundation: t("foundations.orgTypeFoundation"),
    shelter: t("foundations.orgTypeShelter"),
    rescue: t("foundations.orgTypeRescue"),
  }[f.orgType];
  const followedQuery = useQuery({
    queryKey: ["followed-org-ids", userId],
    enabled: !!userId,
    queryFn: () => listFollowedOrgIds(userId!),
  });
  const isFollowing = followedQuery.data?.includes(f.id) ?? false;
  const followMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sign in to follow foundations.");
      if (isFollowing) await unfollowOrg(userId, f.id);
      else await followOrg(userId, f.id);
    },
    onSuccess: () => {
      // See the identical comment on _public.breeders.$slug.tsx's follow mutation — three query
      // keys represent one piece of state, so all three must invalidate together.
      queryClient.invalidateQueries({ queryKey: ["followed-org-ids", userId] });
      queryClient.invalidateQueries({ queryKey: ["my-followed-breeders", userId] });
      queryClient.invalidateQueries({ queryKey: ["my-followed-foundations", userId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update."),
  });

  return (
    <div>
      {/* pointer-events-none: see the matching fix on the breeder detail page — this box is
      purely decorative but, being position:relative, otherwise paints above the overlapping card
      below regardless of DOM order and makes its buttons unclickable */}
      <div className="pointer-events-none relative h-64 bg-secondary md:h-80">
        <AnimalImage src={f.cover} alt="" className="size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      <div className="container-page -mt-24 pb-16">
        <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start gap-6">
            <AnimalImage
              src={f.logo}
              alt={`${t("foundations.logoAltPrefix")} ${f.name}`}
              className="size-24 rounded-2xl border-4 border-background object-cover shadow-md"
            />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-medium">{f.name}</h1>
                <Badge variant="secondary">{orgTypeLabel}</Badge>
                {f.verified && (
                  <Badge className="bg-primary/90 text-primary-foreground">
                    <ShieldCheck className="mr-1 size-3" /> {t("foundations.verified")}
                  </Badge>
                )}
              </div>
              {(f.city || f.country) && (
                <p className="mt-1 text-muted-foreground">
                  <MapPin className="mr-1 inline size-3.5" />
                  {[f.city, f.country].filter(Boolean).join(", ")}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-6 text-sm">
                <Stat
                  label={t("foundations.statDogsForAdoption")}
                  value={String(f.availableForAdoption)}
                />
                {f.association && (
                  <Stat label={t("foundations.statAssociation")} value={f.association} />
                )}
                {f.responseTime && (
                  <Stat label={t("foundations.statResponseTime")} value={f.responseTime} />
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="lg" onClick={() => setTab("animals")}>
                  <HeartHandshake className="mr-1 size-4" /> {t("foundations.viewAnimalsCta")}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  disabled={followMutation.isPending}
                  onClick={() =>
                    isSignedIn
                      ? followMutation.mutate()
                      : toast.info(t("foundations.signInToFollow"))
                  }
                >
                  <Heart
                    className={`mr-1 size-4 ${isFollowing ? "fill-current text-accent" : ""}`}
                  />
                  {isFollowing ? t("foundations.following") : t("foundations.follow")}
                </Button>
              </div>
              <ReportDialog
                targetType="organisation"
                targetId={f.id}
                triggerLabel={t("foundations.reportOrg")}
              />
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-8">
          <TabsList className="w-full flex-wrap justify-start">
            <TabsTrigger value="about">{t("foundations.tabAbout")}</TabsTrigger>
            <TabsTrigger value="animals">{t("foundations.tabAnimals")}</TabsTrigger>
            <TabsTrigger value="updates">{t("foundations.tabUpdates")}</TabsTrigger>
            <TabsTrigger value="transport">{t("foundations.tabTransport")}</TabsTrigger>
            <TabsTrigger value="contact">{t("foundations.tabContact")}</TabsTrigger>
          </TabsList>

          <TabsContent value="about" className="mt-6">
            <Card>
              <h3 className="mb-3 font-display text-xl font-semibold">
                {t("foundations.ourMission")}
              </h3>
              <p className="text-muted-foreground">
                {f.description || t("foundations.noDescription")}
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="animals" className="mt-6">
            {animals.length ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {animals.map((a) => (
                  <AdoptionCard key={a.id} a={a} />
                ))}
              </div>
            ) : (
              <Card>
                <div className="flex items-start gap-3">
                  <HeartHandshake className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  <p className="text-muted-foreground">{t("foundations.noAnimalsPublished")}</p>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="updates" className="mt-6 space-y-3">
            {posts.length ? (
              posts.map((post) => (
                <Card key={post.id}>
                  {post.content && <p className="whitespace-pre-wrap text-sm">{post.content}</p>}
                  <time
                    dateTime={post.created_at}
                    className="mt-2 block text-xs text-muted-foreground"
                  >
                    {formatDate(post.created_at, locale, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </time>
                </Card>
              ))
            ) : (
              <Card>
                <p className="text-muted-foreground">{t("foundations.noUpdatesPublished")}</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="transport" className="mt-6">
            <Card>
              <div className="flex items-start gap-4">
                <Truck className="size-6 text-primary" />
                <div>
                  <h3 className="font-display text-xl font-semibold">
                    {t("foundations.tabTransport")}
                  </h3>
                  <p className="mt-1 text-muted-foreground">
                    {f.transportAvailable
                      ? t("foundations.transportAvailableDesc")
                      : t("foundations.transportUnknownDesc")}
                  </p>
                  <Button asChild variant="outline" className="mt-4">
                    <Link to="/transport">{t("foundations.seeTransportOptions")}</Link>
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="contact" className="mt-6">
            <Card>
              <h3 className="mb-3 font-display text-xl font-semibold">
                {t("foundations.contactProcessTitle")}
              </h3>
              <p className="text-muted-foreground">{t("foundations.contactProcessDesc")}</p>
              <Button className="mt-4" onClick={() => setTab("animals")}>
                {t("foundations.viewAnimals")}
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border/70 bg-card p-6 ${className}`}>{children}</div>
  );
}
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
