import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Truck, MessageCircle, MapPin, Trophy, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getKennelBySlug,
  listPuppiesForKennel,
  listLittersForKennel,
  listParentDogsForKennel,
  listVerifiedChampionsForKennel,
} from "@/lib/queries/marketplace";
import { PuppyCard, LitterCard } from "@/components/cards";
import { ReportDialog } from "@/components/report-dialog";
import { useAuth } from "@/hooks/use-auth";
import { followOrg, listFollowedOrgIds, unfollowOrg } from "@/lib/queries/buyer-activity";

import { getFriendlyErrorMessage } from "@/lib/errors";
export const Route = createFileRoute("/_public/breeders/$slug")({
  loader: async ({ params }) => {
    const b = await getKennelBySlug(params.slug).catch(() => null);
    if (!b) throw notFound();
    const [kPuppies, kPlanned, kParents, kChampions] = await Promise.all([
      listPuppiesForKennel(b.id),
      listLittersForKennel(b.id, "planned"),
      listParentDogsForKennel(b.id),
      listVerifiedChampionsForKennel(b.id),
    ]);
    return { b, kPuppies, kPlanned, kParents, kChampions };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.b.kennel} — Havenpaw` : "Breeder — Havenpaw" },
      {
        name: "description",
        content: loaderData
          ? `${loaderData.b.kennel} in ${loaderData.b.city}, ${loaderData.b.country} — ${loaderData.b.breeds.join(", ") || "dog breeder"} on Havenpaw.`
          : "A breeder profile on Havenpaw.",
      },
    ],
  }),
  component: BreederProfile,
});

function BreederProfile() {
  const { b, kPuppies, kPlanned, kParents, kChampions } = Route.useLoaderData();
  const { userId, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("about");
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

  return (
    <div>
      <div className="relative h-64 bg-secondary md:h-80">
        <img src={b.cover} alt="" className="size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      <div className="container-page -mt-24 pb-16">
        <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start gap-6">
            <img
              src={b.logo}
              alt=""
              className="size-24 rounded-2xl border-4 border-background object-cover shadow-md"
            />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-medium">{b.kennel}</h1>
                {b.verified && (
                  <Badge className="bg-primary/90 text-primary-foreground">
                    <ShieldCheck className="mr-1 size-3" /> Verified
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-muted-foreground">
                {b.name} · <MapPin className="mr-1 inline size-3.5" />
                {b.city}, {b.country}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {b.breeds.map((br) => (
                  <Badge key={br} variant="secondary">
                    {br}
                  </Badge>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-6 text-sm">
                {b.years > 0 && <Stat label="Experience" value={`${b.years} years`} />}
                <Stat label="Available puppies" value={String(b.availablePuppies)} />
                {b.association && <Stat label="Association" value={b.association} />}
                {b.responseTime && <Stat label="Response time" value={b.responseTime} />}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <Button size="lg" onClick={() => setTab("puppies")}>
                  <MessageCircle className="mr-1 size-4" /> Contact breeder
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  disabled={followMutation.isPending}
                  onClick={() =>
                    isSignedIn ? followMutation.mutate() : toast.info("Sign in to follow kennels.")
                  }
                >
                  <Heart
                    className={`mr-1 size-4 ${isFollowing ? "fill-current text-accent" : ""}`}
                  />
                  {isFollowing ? "Following" : "Follow kennel"}
                </Button>
              </div>
              <ReportDialog
                targetType="organisation"
                targetId={b.id}
                triggerLabel="Report this kennel"
              />
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-8">
          <TabsList className="w-full flex-wrap justify-start">
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="puppies">Current puppies</TabsTrigger>
            <TabsTrigger value="planned">Planned litters</TabsTrigger>
            <TabsTrigger value="parents">Parent dogs</TabsTrigger>
            {kChampions.length > 0 && <TabsTrigger value="champions">Champions</TabsTrigger>}
            <TabsTrigger value="health">Health & living</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="transport">Transport</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
          </TabsList>

          <TabsContent value="about" className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <h3 className="mb-3 font-display text-xl font-semibold">About the kennel</h3>
              <p className="text-muted-foreground">
                {b.description || "This breeder hasn't added a description yet."}
              </p>
            </Card>
            <Card>
              <h3 className="mb-3 font-display text-xl font-semibold">How applications work</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>· First contact happens through Havenpaw</li>
                <li>· The breeder reviews and responds to your application</li>
                <li>· Reservation terms are agreed directly with the breeder</li>
              </ul>
            </Card>
          </TabsContent>

          <TabsContent value="puppies" className="mt-6">
            {kPuppies.length ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {kPuppies.map((p) => (
                  <PuppyCard key={p.id} p={p} />
                ))}
              </div>
            ) : (
              <Card>
                <p className="text-muted-foreground">
                  No puppies available right now — check planned litters.
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="planned" className="mt-6">
            {kPlanned.length ? (
              <div className="grid gap-6 lg:grid-cols-2">
                {kPlanned.map((l) => (
                  <LitterCard key={l.id} l={l} planned />
                ))}
              </div>
            ) : (
              <Card>
                <p className="text-muted-foreground">No planned litters yet.</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="parents" className="mt-6 grid gap-6 md:grid-cols-2">
            {kParents.length ? (
              kParents.map((p, i) => (
                <Card key={i}>
                  <div className="flex gap-4">
                    <img src={p.image} alt="" className="size-24 rounded-xl object-cover" />
                    <div>
                      <div className="text-xs uppercase tracking-wide text-accent">
                        {p.sex === "female" ? "Female" : "Male"}
                      </div>
                      <h4 className="mt-1 font-display text-lg font-semibold">{p.name}</h4>
                      {p.pedigree && <p className="text-xs text-muted-foreground">{p.pedigree}</p>}
                      {p.description && (
                        <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="md:col-span-2">
                <p className="text-muted-foreground">No parent dogs listed yet.</p>
              </Card>
            )}
          </TabsContent>

          {kChampions.length > 0 && (
            <TabsContent value="champions" className="mt-6 grid gap-4 md:grid-cols-2">
              {kChampions.map((c) => (
                <Card key={c.dogName}>
                  <div className="flex items-center gap-2">
                    <Trophy className="size-4 text-accent" />
                    <h4 className="font-display text-lg font-semibold">{c.dogName}</h4>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.titles.map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </Card>
              ))}
            </TabsContent>
          )}

          <TabsContent value="health" className="mt-6">
            <Card>
              <h3 className="mb-3 font-display text-xl font-semibold">
                Health & living conditions
              </h3>
              <p className="text-muted-foreground">
                Ask the breeder directly about health testing and living conditions for their
                litters — you can see any health tests recorded for individual parent dogs on the
                Parent dogs tab above.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="reviews" className="mt-6">
            <Card>
              <p className="text-muted-foreground">
                Reviews aren't available yet — they open up once transports through Havenpaw start
                completing.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="transport" className="mt-6">
            <Card>
              <div className="flex items-start gap-4">
                <Truck className="size-6 text-primary" />
                <div>
                  <h3 className="font-display text-xl font-semibold">Transport</h3>
                  <p className="mt-1 text-muted-foreground">
                    Havenpaw can arrange transport for puppies from this kennel. Get an estimate or
                    submit a transport request for the exact route and dates you need.
                  </p>
                  <Button asChild variant="outline" className="mt-4">
                    <Link to="/transport">See transport options</Link>
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="contact" className="mt-6">
            <Card>
              <h3 className="mb-3 font-display text-xl font-semibold">
                Contact & application rules
              </h3>
              <p className="text-muted-foreground">
                All first contact happens through Havenpaw. Apply for a specific puppy, and you can
                message the breeder directly about your application — after they approve it, direct
                contact details are shared.
              </p>
              <Button className="mt-4" onClick={() => setTab("puppies")}>
                View available puppies
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
