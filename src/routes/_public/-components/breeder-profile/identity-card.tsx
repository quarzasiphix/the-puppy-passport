import { MessageCircle, MapPin, Heart, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { useTranslation } from "@/shared/i18n";
import { VerificationBadges } from "./verification";
import type { Breeder, Stats, TrustClaims } from "./types";

// The header card and the stat strip used to be two separate rounded-3xl/rounded-2xl boxes
// stacked with a gap — two borders, two shadows, two rounded rectangles reading as unrelated
// modules. They're one identity: "who this kennel is" and "what they have going on right now"
// belong in a single card, header on top and the stat strip as a distinct footer band inside the
// same border, separated by a single hairline instead of a second full box. Follower count is
// shown once, near the Follow button where a viewer decides whether to follow — not duplicated
// again in the stat strip.
export function IdentityCard({
  b,
  stats,
  trustClaims,
  isFollowing,
  isSignedIn,
  followPending,
  onFollow,
  onContact,
}: {
  b: Breeder;
  stats: Stats;
  trustClaims: TrustClaims;
  isFollowing: boolean;
  isSignedIn: boolean;
  followPending: boolean;
  onFollow: () => void;
  onContact: () => void;
}) {
  const { t } = useTranslation();
  const statItems = [
    { label: t("breederProfile.statAvailablePuppies"), value: stats.availablePuppies },
    { label: t("breederProfile.statPlannedLitters"), value: stats.plannedLitters },
    { label: t("breederProfile.statPreviousLitters"), value: stats.previousLitters },
    { label: t("breederProfile.statPuppiesPlaced"), value: stats.puppiesPlaced },
    { label: t("breederProfile.statBreedingDogs"), value: stats.breedingDogs },
  ];

  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
      <div className="p-6 md:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {/* object-contain, not object-cover: a logo/crest is a whole design (an icon + a name
              banner, in a non-square source image for most kennels), not a photo — cropping it to
              fill a square box cuts off part of the mark instead of just re-framing a photo. */}
          <img
            src={b.logo}
            alt=""
            className="size-24 shrink-0 rounded-2xl border-4 border-background bg-card object-contain p-1 shadow-md sm:size-28"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="font-display text-2xl font-medium sm:text-3xl">{b.kennel}</h1>
              <span className="text-base font-medium text-muted-foreground">@{b.slug}</span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              {b.city}, {b.country}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {b.breeds.map((br) => (
                <Badge key={br} variant="secondary">
                  {br}
                </Badge>
              ))}
            </div>
            <div className="mt-2">
              <VerificationBadges b={b} trustClaims={trustClaims} />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex gap-2">
              <Button
                size="lg"
                className={`flex-1 sm:flex-none ${
                  b.accentColor ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""
                }`}
                onClick={onContact}
              >
                <MessageCircle className="size-4" /> {t("breederProfile.contactBreeder")}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="flex-1 sm:flex-none"
                disabled={followPending}
                onClick={() =>
                  isSignedIn ? onFollow() : toast.info(t("breederProfile.signInToFollow"))
                }
              >
                <Heart className={`size-4 ${isFollowing ? "fill-current text-accent" : ""}`} />
                {isFollowing ? t("breederProfile.following") : t("breederProfile.follow")}
              </Button>
            </div>
            <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground sm:justify-end">
              <Users className="size-3" />
              {stats.followerCount.toLocaleString()}{" "}
              {stats.followerCount === 1
                ? t("breederProfile.followerSingular")
                : t("breederProfile.followerPlural")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-y divide-border/70 border-t border-border/70 bg-secondary/30 sm:grid-cols-5 sm:divide-y-0">
        {statItems.map((it) => (
          <div key={it.label} className="px-2 py-4 text-center">
            <div className="font-display text-xl font-semibold sm:text-2xl">{it.value}</div>
            <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground sm:text-xs">
              {it.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
