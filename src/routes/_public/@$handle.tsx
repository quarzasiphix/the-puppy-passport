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
export const Route = createFileRoute("/_public/@$handle")({
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
      // Canonical tag: the old /breeders/$slug URL redirects here, so only this one is ever meant
      // to be indexed for a given kennel (see the SEO note in breeders.$slug.tsx and
      // docs/PRODUCT_VISION.md's future-microsite canonical-strategy note).
      ...(loaderData
        ? [{ tag: "link", attrs: { rel: "canonical", href: `/@${loaderData.b.slug}` } } as const]
        : []),
    ],
  }),
  component: BreederProfile,
});

const plannedLitterStatuses = new Set(["planned", "born", "applications_open"]);

function BreederProfile() {
  const { b, puppies, alumni, litters, parents, champions, posts, stats, trustClaims } =
    Route.useLoaderData();
  const { userId, isSignedIn } = useAuth();
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
    onError: (err) => toast.error(getFriendlyErrorMessage(err, "Could not update.")),
  });

  // All 8 destinations stay — none are removed or demoted below a "more" menu — only restyled
  // into a scannable pill bar (see ProfileTabsNav). Counts come straight from already-loaded
  // arrays, so nothing here is a fabricated number.
  const tabs: ProfileTab[] = [
    { value: "home", label: "Home", icon: House },
    { value: "puppies", label: "Puppies", icon: PawPrint, count: puppies.length },
    {
      value: "litters",
      label: "Litters",
      icon: Baby,
      count: currentLitters.length + plannedLitters.length,
    },
    { value: "dogs", label: "Dogs", icon: Dog, count: parents.length },
    { value: "alumni", label: "Alumni", icon: Heart, count: alumni.length },
    { value: "posts", label: "Posts", icon: Newspaper, count: posts.length },
    { value: "reviews", label: "Reviews", icon: Star },
    { value: "about", label: "About", icon: Info },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <div>
        <div className="relative h-56 bg-secondary md:h-72">
          <img src={b.cover} alt="" className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
        </div>

        <div className="container-page -mt-20 pb-16">
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
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {puppies.map((p) => (
                    <PuppyCard key={p.id} p={p} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={PawPrint} title="No puppies listed right now">
                  Check the Litters tab for planned litters, or follow this kennel to hear when new
                  ones open.
                </EmptyState>
              )}
            </TabsContent>

            <TabsContent value="litters" className="mt-6 space-y-8">
              <div>
                <h3 className="mb-3 font-display text-lg font-semibold">Current & planned</h3>
                {currentLitters.length || plannedLitters.length ? (
                  <div className="grid gap-6 lg:grid-cols-2">
                    {[...currentLitters, ...plannedLitters].map((l) => (
                      <LitterCard key={l.id} l={l} planned={plannedLitters.includes(l)} />
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Baby} title="No current or planned litters">
                    Follow this kennel to hear as soon as a new litter is announced.
                  </EmptyState>
                )}
              </div>
            </TabsContent>

            <TabsContent value="dogs" className="mt-6 space-y-8">
              {parents.length ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {parents.map((p, i) => (
                    <ParentDogCard key={i} p={p} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Dog} title="No breeding dogs listed yet">
                  This kennel hasn't added their breeding dogs yet.
                </EmptyState>
              )}
              {champions.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-1.5 font-display text-lg font-semibold">
                    <Trophy className="size-4 text-accent" /> Champions
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {champions.map((c) => (
                      <div
                        key={c.dogName}
                        className="rounded-2xl border border-border/70 bg-card p-5"
                      >
                        <h4 className="font-display text-lg font-semibold">{c.dogName}</h4>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {c.titles.map((t) => (
                            <Badge key={t} variant="secondary">
                              {t}
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
              <EmptyState icon={Star} title="Reviews aren't open yet">
                They open up once transports through Anemalo start completing.
              </EmptyState>
            </TabsContent>

            <TabsContent value="about" className="mt-6 grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-card p-6 lg:col-span-2">
                <h3 className="mb-3 font-display text-xl font-semibold">About the kennel</h3>
                <p className="text-muted-foreground">
                  {b.description || "This breeder hasn't added a description yet."}
                </p>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/70 bg-card p-6">
                  <h3 className="mb-3 font-display text-lg font-semibold">Verification</h3>
                  <VerificationList b={b} trustClaims={trustClaims} stats={stats} />
                </div>
                <div className="rounded-2xl border border-border/70 bg-card p-6">
                  <h3 className="mb-3 font-display text-lg font-semibold">How applications work</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>· First contact happens through Anemalo</li>
                    <li>· The breeder reviews and responds to your application</li>
                    <li>
                      · Reservation terms — including any deposit — are agreed through Anemalo
                    </li>
                  </ul>
                </div>
                <ReportDialog
                  targetType="organisation"
                  targetId={b.id}
                  triggerLabel="Report this kennel"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  );
}
