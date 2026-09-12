import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trophy, House, PawPrint, Baby, Dog, Heart, Newspaper, Star, Info } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Tabs, TabsContent } from "@/shared/ui/tabs";
import { TooltipProvider } from "@/shared/ui/tooltip";
import {
  getKennelBySlug,
  listPuppiesForKennel,
  listAlumniForKennel,
  listLittersForKennel,
  listParentDogsForKennel,
  listVerifiedChampionsForKennel,
  PuppyCard,
  LitterCard,
  followOrg,
  listFollowedOrgIds,
  unfollowOrg,
} from "@/domains/marketplace";
import { ReportDialog, getTrustClaimMap } from "@/domains/trust";
import { getBreederStats } from "@/domains/breeders";
import { useAuth } from "@/domains/identity";
import { listKennelPosts, KennelPostComposer, type PostSummary } from "@/domains/social";
import { getAccentCssVars } from "@/domains/breeders";
import { useTranslation } from "@/shared/i18n";
import { SITE_ORIGIN } from "@/lib/sitemap";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";
import { IdentityCard } from "./-components/breeder-profile/identity-card";
import { ProfileTabsNav, type ProfileTab } from "./-components/breeder-profile/profile-tabs-nav";
import { HomeTab } from "./-components/breeder-profile/home-tab";
import { AlumniTab } from "./-components/breeder-profile/alumni-tab";
import { PostsList } from "./-components/breeder-profile/posts-list";
import { ParentDogCard } from "./-components/breeder-profile/parent-dog-card";
import { VerificationList } from "./-components/breeder-profile/verification";
import { EmptyState } from "./-components/breeder-profile/empty-state";
import type {
  Breeder,
  Champions,
  Litters,
  Parents,
  Posts,
  Puppies,
  Stats,
  TrustClaims,
} from "./-components/breeder-profile/types";

type LoaderData = {
  b: Breeder;
  puppies: Puppies;
  alumni: Puppies;
  litters: Litters;
  parents: Parents;
  champions: Champions;
  posts: Posts;
  stats: Stats;
  trustClaims: TrustClaims;
};

// Canonical public breeder identity URL: anemalo.com/@handle — a permanent profile a breeder can
// link from Facebook/Instagram/their own site, whether or not they currently have puppies
// available (see the breeder-profile redesign brief). `organisations.slug` already existed and is
// already URL-safe/unique (auto-generated in approve_user_verification()) — this route is the only
// schema-level thing that needed to change to support handles: which URL is canonical. The old
// /breeders/$slug path now redirects here (see breeders.$slug.tsx) so the two never both get
// indexed as separate pages for the same profile.
export const Route = createFileRoute("/_public/@{$handle}")({
  loader: async ({ params }): Promise<LoaderData> => {
    const b = await getKennelBySlug(params.handle).catch(() => null);
    if (!b) throw notFound();
    const [puppies, alumni, litters, parents, champions, posts, stats, trustClaims] =
      await Promise.all([
        listPuppiesForKennel(b.id),
        listAlumniForKennel(b.id),
        listLittersForKennel(b.id),
        listParentDogsForKennel(b.id),
        listVerifiedChampionsForKennel(b.id),
        listKennelPosts(b.id).catch(() => [] as PostSummary[]),
        getBreederStats(b.id, b.verified),
        getTrustClaimMap(b.id),
      ]);
    return { b, puppies, alumni, litters, parents, champions, posts, stats, trustClaims };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.b.kennel} (@${loaderData.b.slug}) — Anemalo`
          : "Breeder — Anemalo",
      },
      {
        name: "description",
        content: loaderData
          ? `${loaderData.b.kennel} — ${loaderData.b.breeds.join(", ") || "dog breeder"} in ${loaderData.b.city}, ${loaderData.b.country}. Follow their litters, dogs and history on Anemalo.`
          : "A breeder profile on Anemalo.",
      },
      ...(loaderData
        ? [
            { property: "og:title", content: `${loaderData.b.kennel} (@${loaderData.b.slug})` },
            { property: "og:type", content: "profile" },
            { property: "og:image", content: loaderData.b.cover || loaderData.b.logo },
            {
              "script:ld+json": {
                "@context": "https://schema.org",
                "@type": "Organization",
                name: loaderData.b.kennel,
                url: `${SITE_ORIGIN}/@${loaderData.b.slug}`,
                logo: loaderData.b.logo || undefined,
                image: loaderData.b.cover || undefined,
                address: {
                  "@type": "PostalAddress",
                  addressLocality: loaderData.b.city || undefined,
                  addressCountry: loaderData.b.country || undefined,
                },
              },
            },
          ]
        : []),
    ],
    // Canonical tag: the old /breeders/$slug URL redirects here, so only this one is ever meant
    // to be indexed for a given kennel (see the SEO note in breeders.$slug.tsx and
    // docs/PRODUCT_VISION.md's future-microsite canonical-strategy note). Must be a top-level
    // `links` entry, not nested inside `meta` — that shape never actually renders a <link> tag.
    links: loaderData ? [{ rel: "canonical", href: `${SITE_ORIGIN}/@${loaderData.b.slug}` }] : [],
  }),
  component: BreederProfile,
});

const plannedLitterStatuses = new Set(["planned", "born", "applications_open"]);

function BreederProfile() {
  const { b, puppies, alumni, litters, parents, champions, posts, stats, trustClaims } =
    Route.useLoaderData();
  const { userId, isSignedIn } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("home");
  const isOwner = !!userId && userId === b.ownerId;

  const currentLitters = litters.filter((l) => l.available > 0 || l.reserved > 0);
  const plannedLitters = litters.filter((l) =>
    plannedLitterStatuses.has((l as unknown as { status?: string }).status ?? ""),
  );

  const followedQuery = useQuery({
    queryKey: ["followed-org-ids", userId],
    enabled: !!userId,
    queryFn: () => listFollowedOrgIds(userId!),
  });
  const isFollowing = followedQuery.data?.includes(b.id) ?? false;
  const followMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sign in to follow kennels.");
      if (isFollowing) await unfollowOrg(userId, b.id);
      else await followOrg(userId, b.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["followed-org-ids", userId] }),
    onError: (err) => toast.error(getFriendlyErrorMessage(err, t("breederProfile.couldNotUpdate"))),
  });

  // All 8 destinations stay — none are removed or demoted below a "more" menu — only restyled
  // into a scannable pill bar (see ProfileTabsNav). Counts come straight from already-loaded
  // arrays, so nothing here is a fabricated number.
  const tabs: ProfileTab[] = [
    { value: "home", label: t("breederProfile.tabHome"), icon: House },
    {
      value: "puppies",
      label: t("breederProfile.tabPuppies"),
      icon: PawPrint,
      count: puppies.length,
    },
    {
      value: "litters",
      label: t("breederProfile.tabLitters"),
      icon: Baby,
      count: currentLitters.length + plannedLitters.length,
    },
    { value: "dogs", label: t("breederProfile.tabDogs"), icon: Dog, count: parents.length },
    { value: "alumni", label: t("breederProfile.tabAlumni"), icon: Heart, count: alumni.length },
    { value: "posts", label: t("breederProfile.tabPosts"), icon: Newspaper, count: posts.length },
    { value: "reviews", label: t("breederProfile.tabReviews"), icon: Star },
    { value: "about", label: t("breederProfile.tabAbout"), icon: Info },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      {/* A kennel's own brand color (see brand-color.ts) — their whole public profile is "their
          own space", not a mixed grid with other kennels, so it gets the full accent override
          rather than the contained border/badge treatment used on shared marketplace cards. */}
      <div style={getAccentCssVars(b.accentColor)}>
        {/* A plain color band, not the kennel's cover photo — a wide crop of a close-up pet photo
            reads badly as a banner (see the redesign note this replaced). Uses the kennel's own
            brand color when set, the same site-wide primary/accent gradient otherwise. No fade
            scrim on top — that was there to keep text legible over a *photo*; text now lives
            entirely in the opaque card below, so a scrim here was just a veil with nothing under
            it to fade, washing out the card wherever the two overlap via -mt-20. */}
        <div
          className={`h-40 md:h-52 ${
            b.accentColor ? "" : "bg-gradient-to-br from-primary/25 via-accent/15 to-secondary"
          }`}
          style={
            b.accentColor
              ? {
                  background: `linear-gradient(135deg, ${b.accentColor} 0%, ${b.accentColor}99 55%, var(--secondary) 100%)`,
                }
              : undefined
          }
        />

        {/* Not the shared container-page utility here — its fixed 1.5rem side padding wastes real
            width on a phone-sized screen where every extra pixel matters for the puppy/litter
            grids below. px-4 sm:px-6 keeps the same 1.5rem on tablet/desktop but tightens to 1rem
            on mobile; ProfileTabsNav's sticky bar cancels this exact value with a matching
            negative margin to go edge-to-edge when stuck, so the two must stay in sync. */}
        <div className="mx-auto max-w-[1280px] px-4 -mt-20 pb-16 sm:px-6">
          <IdentityCard
            b={b}
            stats={stats}
            trustClaims={trustClaims}
            isFollowing={isFollowing}
            isSignedIn={isSignedIn}
            followPending={followMutation.isPending}
            onFollow={() => followMutation.mutate()}
            onContact={() => setTab("puppies")}
          />

          <Tabs value={tab} onValueChange={setTab} className="mt-6">
            <ProfileTabsNav tabs={tabs} />

            <TabsContent value="home" className="mt-6 space-y-8">
              <HomeTab
                b={b}
                puppies={puppies}
                plannedLitters={plannedLitters}
                parents={parents}
                posts={posts}
                trustClaims={trustClaims}
                stats={stats}
                onSeeAllPuppies={() => setTab("puppies")}
                onSeeAllPosts={() => setTab("posts")}
              />
            </TabsContent>

            <TabsContent value="puppies" className="mt-6">
              {puppies.length ? (
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {puppies.map((p) => (
                    <PuppyCard key={p.id} p={p} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={PawPrint} title={t("breederProfile.noPuppiesTitle")}>
                  {t("breederProfile.noPuppiesDesc")}
                </EmptyState>
              )}
            </TabsContent>

            <TabsContent value="litters" className="mt-6 space-y-8">
              <div>
                <h3 className="mb-3 font-display text-lg font-semibold">
                  {t("breederProfile.currentAndPlanned")}
                </h3>
                {currentLitters.length || plannedLitters.length ? (
                  <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
                    {[...currentLitters, ...plannedLitters].map((l) => (
                      <LitterCard key={l.id} l={l} planned={plannedLitters.includes(l)} />
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Baby} title={t("breederProfile.noLittersTitle")}>
                    {t("breederProfile.noLittersDesc")}
                  </EmptyState>
                )}
              </div>
            </TabsContent>

            <TabsContent value="dogs" className="mt-6 space-y-8">
              {parents.length ? (
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                  {parents.map((p, i) => (
                    <ParentDogCard key={i} p={p} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Dog} title={t("breederProfile.noDogsTitle")}>
                  {t("breederProfile.noDogsDesc")}
                </EmptyState>
              )}
              {champions.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-1.5 font-display text-lg font-semibold">
                    <Trophy className="size-4 text-accent" /> {t("breederProfile.champions")}
                  </h3>
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                    {champions.map((c) => (
                      <div
                        key={c.dogName}
                        className="rounded-2xl border border-border/70 bg-card p-5"
                      >
                        <h4 className="font-display text-lg font-semibold">{c.dogName}</h4>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {c.titles.map((title) => (
                            <Badge key={title} variant="secondary">
                              {title}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="alumni" className="mt-6">
              <AlumniTab alumni={alumni} kennelName={b.kennel} />
            </TabsContent>

            <TabsContent value="posts" className="mt-6 space-y-4">
              {isOwner && (
                <KennelPostComposer
                  organisationId={b.id}
                  authorProfileId={userId!}
                  litters={litters.map((l) => ({ id: l.id, label: `${l.breed} — ${l.code}` }))}
                  puppies={puppies.map((p) => ({ id: p.id, label: p.name }))}
                />
              )}
              <PostsList posts={posts} />
            </TabsContent>

            <TabsContent value="reviews" className="mt-6">
              <EmptyState icon={Star} title={t("breederProfile.noReviewsTitle")}>
                {t("breederProfile.noReviewsDesc")}
              </EmptyState>
            </TabsContent>

            <TabsContent value="about" className="mt-6 grid gap-6 grid-cols-1 lg:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-card p-6 lg:col-span-2">
                <h3 className="mb-3 font-display text-xl font-semibold">
                  {t("breederProfile.aboutKennelTitle")}
                </h3>
                <p className="text-muted-foreground">
                  {b.description || t("breederProfile.noKennelDescription")}
                </p>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/70 bg-card p-6">
                  <h3 className="mb-3 font-display text-lg font-semibold">
                    {t("breederProfile.verificationTitle")}
                  </h3>
                  <VerificationList b={b} trustClaims={trustClaims} stats={stats} />
                </div>
                <div className="rounded-2xl border border-border/70 bg-card p-6">
                  <h3 className="mb-3 font-display text-lg font-semibold">
                    {t("breederProfile.howApplicationsWorkTitle")}
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>· {t("breederProfile.applicationStep1")}</li>
                    <li>· {t("breederProfile.applicationStep2")}</li>
                    <li>· {t("breederProfile.applicationStep3")}</li>
                  </ul>
                </div>
                <ReportDialog
                  targetType="organisation"
                  targetId={b.id}
                  triggerLabel={t("breederProfile.reportKennel")}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  );
}
