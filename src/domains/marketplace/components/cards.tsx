import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Calendar, Truck, Heart } from "lucide-react";
import type { Puppy, Litter, Breeder } from "@/lib/mock-data";
import type { AdoptionListing } from "../services/marketplace";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/domains/identity";
import { useTranslation, type Locale } from "@/shared/i18n";
import { listSavedAnimalIds, saveAnimal, unsaveAnimal } from "../services/buyer-activity";
import { accentGlowStyle, VerifiedBadge } from "@/domains/breeders";

// Polish plural forms don't map to a single dot-path key (they depend on the count), so these
// small formatting helpers build the final string around t() for the parts that are static —
// see the i18n file header / CLAUDE.md note on interpolation not being supported by t().
function plYearsWord(n: number): string {
  if (n === 1) return "rok";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "lata";
  return "lat";
}

function plPeopleWord(n: number): string {
  if (n === 1) return "osoba";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "osoby";
  return "osób";
}

export function formatExperience(locale: Locale, years: number): string {
  return locale === "pl"
    ? `${years} ${plYearsWord(years)} doświadczenia`
    : `${years} yrs experience`;
}

export function formatPuppiesAvailable(locale: Locale, count: number): string {
  return locale === "pl" ? `Dostępnych szczeniąt: ${count}` : `${count} puppies available`;
}

export function formatWaitingList(locale: Locale, count: number): string {
  return locale === "pl"
    ? `Lista oczekujących: ${count} ${plPeopleWord(count)}`
    : `Waiting list: ${count} ${count === 1 ? "person" : "people"}`;
}

export function formatDate(
  locale: Locale,
  iso: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Date(iso).toLocaleDateString(locale === "pl" ? "pl-PL" : "en-GB", options);
}

// Shared across every card on a page — react-query dedupes identical keys, so this is one query
// per page, not one per card.
export function useIsSaved(animalId: string) {
  const { userId } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const savedQuery = useQuery({
    queryKey: ["saved-animal-ids", userId],
    enabled: !!userId,
    queryFn: () => listSavedAnimalIds(userId!),
    staleTime: 30_000,
  });
  const isSaved = savedQuery.data?.includes(animalId) ?? false;
  const toggle = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error(t("cards.signInToSave"));
      if (isSaved) await unsaveAnimal(userId, animalId);
      else await saveAnimal(userId, animalId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-animal-ids", userId] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : t("cards.couldNotUpdate")),
  });
  return { isSaved, toggle: () => toggle.mutate(), pending: toggle.isPending };
}

function SaveButton({ animalId }: { animalId: string }) {
  const { isSaved, toggle, pending } = useIsSaved(animalId);
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-label={isSaved ? t("cards.removeFromSaved") : t("cards.save")}
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      className={`absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-background/85 shadow-sm backdrop-blur transition-colors hover:text-accent ${isSaved ? "text-accent" : "text-muted-foreground"}`}
    >
      <Heart className={`size-4 ${isSaved ? "fill-current" : ""}`} />
    </button>
  );
}

export const statusStyles: Record<Puppy["status"], string> = {
  available: "bg-success/15 text-success border-success/30",
  "applications-open": "bg-accent/15 text-accent border-accent/30",
  reserved: "bg-warning/20 text-foreground border-warning/40",
  sold: "bg-muted text-muted-foreground border-border",
  draft: "bg-muted text-muted-foreground border-border",
};

/** Translates a puppy status into the current locale. `t` is the `useTranslation().t` function —
 * pass it in rather than calling the hook here, since this is used both from components and from
 * plain render helpers. */
export function statusLabelFor(t: (key: string) => string, status: Puppy["status"]): string {
  const map: Record<Puppy["status"], string> = {
    available: t("cards.statusAvailable"),
    "applications-open": t("cards.statusApplicationsOpen"),
    reserved: t("cards.statusReserved"),
    sold: t("cards.statusSold"),
    draft: t("cards.statusDraft"),
  };
  return map[status];
}

export function PuppyCard({ p }: { p: Puppy }) {
  const { t, locale } = useTranslation();
  return (
    <article
      style={accentGlowStyle(p.accentColor)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
        <img
          src={p.image}
          alt={p.name}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusStyles[p.status]}`}
          >
            {statusLabelFor(t, p.status)}
          </span>
        </div>
        <SaveButton animalId={p.id} />
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
          {p.verified && (
            <VerifiedBadge accentColor={p.accentColor}>{t("cards.verifiedBreeder")}</VerifiedBadge>
          )}
          {p.transportAvailable && (
            <Badge variant="secondary" className="bg-background/85">
              <Truck className="mr-1 size-3" /> {t("cards.transport")}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-semibold leading-tight">{p.name}</h3>
            <p className="text-sm text-muted-foreground">
              {p.breed} · {p.sex} · {p.ageWeeks} wks
            </p>
          </div>
          <div className="text-right">
            <div className="font-display text-lg font-semibold">
              {p.pricePLN.toLocaleString()} PLN
            </div>
            <div className="text-xs text-muted-foreground">≈ €{p.priceEUR.toLocaleString()}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" /> {p.city}, {p.country}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-3.5" /> {t("cards.readyPrefix")}{" "}
            {formatDate(locale, p.readyDate, { day: "numeric", month: "short" })}
          </span>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {p.accentColor && (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: p.accentColor }}
              aria-hidden
            />
          )}
          {p.kennel}
        </p>
        {/* Inline style, not a bg-accent/text-accent utility: this card also renders on mixed,
            multi-kennel pages (find-a-dog, planned-litters) where the page never overrides the
            global --accent variable — a Tailwind accent class would paint every branded kennel's
            button the same site-default color instead of each kennel's own hex. Safe on the
            single-kennel profile page too, just redundant with that page's --accent override. */}
        <Button
          asChild
          className="mt-auto hover:opacity-90"
          style={p.accentColor ? { backgroundColor: p.accentColor, color: "#ffffff" } : undefined}
        >
          <Link to="/puppies/$id" params={{ id: p.id }}>
            {t("cards.viewPuppy")}
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function AdoptionCard({ a }: { a: AdoptionListing }) {
  const { t, locale } = useTranslation();
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
        <img
          src={a.image}
          alt={a.name}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <SaveButton animalId={a.id} />
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
          {a.category === "private_rehoming" ? (
            <Badge variant="secondary" className="bg-background/85">
              {t("cards.privateRehoming")}
            </Badge>
          ) : (
            a.verified && <VerifiedBadge>{t("cards.verifiedFoundation")}</VerifiedBadge>
          )}
          {a.transportAvailable && (
            <Badge variant="secondary" className="bg-background/85">
              <Truck className="mr-1 size-3" /> {t("cards.transport")}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-semibold leading-tight">{a.name}</h3>
            <p className="text-sm text-muted-foreground">
              {a.breed} · {a.sex} · {a.approxAge}
            </p>
          </div>
          {a.adoptionFee != null && (
            <div className="text-right">
              <div className="font-display text-lg font-semibold">
                {a.adoptionFee.toLocaleString()} {a.currency}
              </div>
              <div className="text-xs text-muted-foreground">{t("cards.adoptionFee")}</div>
            </div>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5" /> {a.city}, {a.country}
        </span>
        <p className="line-clamp-2 text-sm text-muted-foreground">{a.description}</p>
        <p className="text-sm text-muted-foreground">{a.orgName}</p>
        <Button asChild className="mt-auto">
          <Link to="/adoptions/$id" params={{ id: a.id }}>
            {locale === "pl" ? `${t("cards.meet")}: ${a.name}` : `${t("cards.meet")} ${a.name}`}
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function LitterCard({ l, planned = false }: { l: Litter; planned?: boolean }) {
  const { t, locale } = useTranslation();
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="relative aspect-[16/9] overflow-hidden bg-secondary">
        <img src={l.image} alt={l.code} loading="lazy" className="size-full object-cover" />
        {/* Inline style when a kennel has its own color, for the same mixed-multi-kennel-page
            reason as PuppyCard's button above. */}
        <Badge
          className={
            l.accentColor
              ? "absolute left-3 top-3 text-white"
              : "absolute left-3 top-3 border-primary/30 bg-primary/90 text-primary-foreground"
          }
          style={l.accentColor ? { backgroundColor: l.accentColor, borderColor: `${l.accentColor}4d` } : undefined}
        >
          {planned ? t("cards.plannedLitter") : t("cards.currentLitter")}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="font-display text-lg font-semibold">{l.breed}</h3>
          <p className="text-sm text-muted-foreground">{l.code}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Meta
            label={planned ? t("cards.expectedBirth") : t("cards.born")}
            value={formatDate(locale, l.birthDate, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          />
          <Meta
            label={t("cards.collectionReady")}
            value={formatDate(locale, l.readyDate, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          />
          <Meta label={t("cards.mother")} value={l.mother} />
          <Meta label={t("cards.father")} value={l.father} />
          <Meta label={t("cards.breederLabel")} value={l.kennel} />
          <Meta
            label={planned ? t("cards.approxPlaces") : t("cards.litterAvailable")}
            value={`${l.available} / ${l.puppyCount}`}
          />
        </dl>
        {planned && (
          <p className="rounded-lg bg-secondary/70 px-3 py-2 text-xs text-muted-foreground">
            {formatWaitingList(locale, l.waitingList)}
          </p>
        )}
        {/* Same overflow bug as the profile header's Contact/Follow pair (see identity-card.tsx):
            two flex-1 buttons can't shrink below their own text, and "Dołącz do listy
            oczekujących" (Join waiting list) alone is wider than a phone screen's card. Stack
            full-width below `sm`, restore the even side-by-side split above it. */}
        <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row">
          <Button asChild variant="outline" className="w-full sm:flex-1">
            <Link to="/litters/$id" params={{ id: l.id }}>
              {t("cards.viewLitter")}
            </Link>
          </Button>
          {planned && (
            <Button
              className="w-full hover:opacity-90 sm:flex-1"
              style={
                l.accentColor ? { backgroundColor: l.accentColor, color: "#ffffff" } : undefined
              }
              disabled
              title={t("cards.joinWaitingListTooltip")}
            >
              {t("cards.joinWaitingList")}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function BreederCard({ b }: { b: Breeder }) {
  const { t, locale } = useTranslation();
  return (
    <article
      style={accentGlowStyle(b.accentColor)}
      className="flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-secondary">
        <img src={b.cover} alt={b.kennel} loading="lazy" className="size-full object-cover" />
        {b.verified && (
          <VerifiedBadge accentColor={b.accentColor} className="absolute right-3 top-3">
            {t("cards.verified")}
          </VerifiedBadge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-1.5 font-display text-lg font-semibold">
              {b.accentColor && (
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: b.accentColor }}
                  aria-hidden
                />
              )}
              {b.kennel}
            </h3>
            <p className="text-sm text-muted-foreground">
              {b.name} · {b.city}, {b.country}
            </p>
          </div>
          {b.responseTime && (
            <div className="text-right text-sm">
              <div className="text-xs text-muted-foreground">{t("cards.responds")}</div>
              <div className="font-medium">{b.responseTime}</div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {b.breeds.map((br) => (
            <Badge key={br} variant="secondary">
              {br}
            </Badge>
          ))}
        </div>
        <p className="line-clamp-3 text-sm text-muted-foreground">{b.description}</p>
        <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span>{formatExperience(locale, b.years)}</span>
          <span>{formatPuppiesAvailable(locale, b.availablePuppies)}</span>
        </div>
        <Button asChild variant="outline" className="mt-1">
          <Link to="/@{$handle}" params={{ handle: b.slug }}>
            {t("cards.viewProfile")}
          </Link>
        </Button>
      </div>
    </article>
  );
}
