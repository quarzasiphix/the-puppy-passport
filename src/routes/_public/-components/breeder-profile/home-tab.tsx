import { Sparkles, PawPrint } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useTranslation } from "@/shared/i18n";
import { LitterCard, PuppyCard } from "@/domains/marketplace";
import { PostsList } from "./posts-list";
import { ParentDogCard } from "./parent-dog-card";
import { VerificationList } from "./verification";
import type { Breeder, Litters, Parents, Posts, Puppies, Stats, TrustClaims } from "./types";

export function HomeTab({
  b,
  puppies,
  plannedLitters,
  parents,
  posts,
  trustClaims,
  stats,
  onSeeAllPuppies,
  onSeeAllPosts,
}: {
  b: Breeder;
  puppies: Puppies;
  plannedLitters: Litters;
  parents: Parents;
  posts: Posts;
  trustClaims: TrustClaims;
  stats: Stats;
  onSeeAllPuppies: () => void;
  onSeeAllPosts: () => void;
}) {
  const { t } = useTranslation();
  // "Available now" means available — a reserved puppy under this heading directly contradicts
  // it (listPuppiesForKennel deliberately still includes reserved ones, for the full Puppies tab,
  // where the Reserved badge on the card itself makes the state honest; this heading doesn't have
  // per-card room for that nuance, so it filters them out instead).
  const availableNow = puppies.filter(
    (p) => p.status === "available" || p.status === "applications-open",
  );
  return (
    <>
      {availableNow.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">
              {t("breederProfile.availableNow")}
            </h3>
            <Button variant="link" size="sm" onClick={onSeeAllPuppies}>
              {t("breederProfile.seeAll")}
            </Button>
          </div>
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {availableNow.slice(0, 3).map((p) => (
              <PuppyCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}

      {plannedLitters.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-1.5 font-display text-lg font-semibold">
            <Sparkles className="size-4 text-accent" /> {t("breederProfile.planned")}
          </h3>
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {plannedLitters.slice(0, 2).map((l) => (
              <LitterCard key={l.id} l={l} planned />
            ))}
          </div>
        </section>
      )}

      {parents.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-1.5 font-display text-lg font-semibold">
            <PawPrint className="size-4" /> {t("breederProfile.statBreedingDogs")}
          </h3>
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            {parents.slice(0, 2).map((p, i) => (
              <ParentDogCard key={i} p={p} />
            ))}
          </div>
        </section>
      )}

      {posts.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">
              {t("breederProfile.recentUpdates")}
            </h3>
            <Button variant="link" size="sm" onClick={onSeeAllPosts}>
              {t("breederProfile.seeAll")}
            </Button>
          </div>
          <PostsList posts={posts.slice(0, 3)} />
        </section>
      )}

      <section className="rounded-2xl border border-border/70 bg-card p-6">
        <h3 className="mb-3 font-display text-lg font-semibold">{t("breederProfile.trust")}</h3>
        <VerificationList b={b} trustClaims={trustClaims} stats={stats} />
      </section>
    </>
  );
}
