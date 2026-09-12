import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Dog,
  CalendarCheck,
  Truck,
  PawPrint,
  Baby,
  Inbox,
  User,
  ArrowRight,
  Clock,
} from "lucide-react";
import { useAuth } from "@/domains/identity";
import {
  getMyKennel,
  listKennelLitters,
  listKennelPuppies,
  animalCoverPhotoUrl,
  litterStatusLabel,
  puppyStatusLabel,
  QuickActionTile,
  BigStat,
  ParentAvatarPair,
} from "@/domains/breeders";
import { listTransportRequestsForKennel } from "@/domains/transport";
import {
  listReservationsForMyKennel,
  isReservationAwaitingBreederAction,
} from "@/domains/reservations";
import { Badge } from "@/shared/ui/badge";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/dashboard/breeder/")({
  component: BreederOverview,
});

function BreederOverview() {
  const { userId } = useAuth();
  const { t } = useTranslation();
  const { data: kennel } = useQuery({
    queryKey: ["my-kennel", userId],
    enabled: !!userId,
    queryFn: () => getMyKennel(userId!),
  });

  const { data: litters } = useQuery({
    queryKey: ["kennel-litters", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listKennelLitters(kennel!.id),
  });
  const { data: puppies } = useQuery({
    queryKey: ["kennel-puppies", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listKennelPuppies(kennel!.id),
  });
  const { data: reservations } = useQuery({
    queryKey: ["kennel-reservations", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listReservationsForMyKennel(kennel!.id),
  });
  const { data: transportRequests } = useQuery({
    queryKey: ["kennel-transport-requests", kennel?.id],
    enabled: !!kennel?.id,
    queryFn: () => listTransportRequestsForKennel(kennel!.id),
  });

  const activePuppies = (puppies ?? []).filter(
    (p) => p.availability_status !== "sold" && p.availability_status !== "withdrawn",
  ).length;
  const pendingReservations = (reservations ?? []).filter((r) =>
    isReservationAwaitingBreederAction(r.status),
  ).length;

  const recentLitters = (litters ?? []).slice(0, 3);
  const recentPuppies = (puppies ?? []).slice(0, 3);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">
          {kennel?.name
            ? `${t("breederPanel.home.welcomeBackPrefix")} ${kennel.name}`
            : t("breederPanel.home.welcomeBack")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("breederPanel.home.subtitle")}</p>
      </header>

      {/* A rejected/suspended kennel's `breeder` role is itself no longer active (see
          reject_user_verification()), so requireRole already keeps them out of this dashboard
          entirely -- the only reachable non-approved state here is "pending review". */}
      {kennel && kennel.verification_status === "pending" && (
        <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <Clock className="mt-0.5 size-5 shrink-0 text-accent" />
          <div>
            <p className="text-sm font-semibold">{t("breederPanel.home.unverifiedBannerTitle")}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("breederPanel.home.unverifiedBannerBody")}
            </p>
          </div>
        </div>
      )}

      {/* Big action tiles — the 4 things a breeder does most often, one tap away */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickActionTile
          to="/dashboard/breeder/puppies"
          label={t("breederPanel.home.actionAddPuppy")}
          icon={PawPrint}
          tone="primary"
        />
        <QuickActionTile
          to="/dashboard/breeder/litters"
          label={t("breederPanel.home.actionAddLitter")}
          icon={Baby}
          tone="accent"
        />
        <QuickActionTile
          to="/dashboard/breeder/applications"
          label={t("breederPanel.home.actionApplications")}
          icon={Inbox}
          tone="success"
        />
        <QuickActionTile
          to="/dashboard/breeder/profile"
          label={t("breederPanel.home.actionMyProfile")}
          icon={User}
          tone="warning"
        />
      </section>

      {/* Summary numbers */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BigStat
          icon={Baby}
          label={t("breederPanel.home.statLitters")}
          value={litters?.length ?? 0}
          tone="accent"
        />
        <BigStat
          icon={Dog}
          label={t("breederPanel.home.statActivePuppies")}
          value={activePuppies}
          tone="primary"
        />
        <BigStat
          icon={CalendarCheck}
          label={t("breederPanel.home.statReservations")}
          value={pendingReservations}
          tone="success"
        />
        <BigStat
          icon={Truck}
          label={t("breederPanel.home.statTransport")}
          value={transportRequests?.length ?? 0}
          tone="warning"
        />
      </section>

      {/* Recent litters */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">{t("breederPanel.home.recentLitters")}</h2>
          <Link
            to="/dashboard/breeder/litters"
            className="text-sm font-semibold text-primary hover:underline"
          >
            {t("breederPanel.home.seeAll")}
          </Link>
        </div>
        {!recentLitters.length ? (
          <EmptyRow text={t("breederPanel.home.emptyLitters")} />
        ) : (
          <div className="space-y-3">
            {recentLitters.map((l) => (
              <Link
                key={l.id}
                to="/dashboard/breeder/litters/$id"
                params={{ id: l.id }}
                className="flex items-center gap-3 rounded-3xl bg-card p-3 shadow-sm transition hover:shadow-md"
              >
                <ParentAvatarPair mother={l.mother} father={l.father} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-bold">{l.code}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {l.breeds?.name ?? t("breederPanel.home.breedNotSet")} · {l.totalPuppies}{" "}
                    {t("breederPanel.home.puppiesCountSuffix")}
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    {litterStatusLabel(t, l.status)}
                  </Badge>
                </div>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ArrowRight className="size-5" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent puppies */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">{t("breederPanel.home.recentPuppies")}</h2>
          <Link
            to="/dashboard/breeder/puppies"
            className="text-sm font-semibold text-primary hover:underline"
          >
            {t("breederPanel.home.seeAll")}
          </Link>
        </div>
        {!recentPuppies.length ? (
          <EmptyRow text={t("breederPanel.home.emptyPuppies")} />
        ) : (
          <div className="space-y-3">
            {recentPuppies.map((p) => {
              const photo = animalCoverPhotoUrl(p);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-3xl bg-card p-3 shadow-sm"
                >
                  {photo ? (
                    <img src={photo} alt="" className="size-16 shrink-0 rounded-2xl object-cover" />
                  ) : (
                    <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-secondary text-muted-foreground">
                      <Dog className="size-6" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-bold">{p.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {p.breeds?.name ?? t("breederPanel.home.breedNotSet")}
                      {p.litters?.code && ` · ${p.litters.code}`}
                    </p>
                    <Badge variant="secondary" className="mt-1">
                      {puppyStatusLabel(t, p.availability_status)}
                    </Badge>
                  </div>
                  <Link
                    to="/dashboard/breeder/puppies"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                    aria-label={t("breederPanel.home.openPuppies")}
                  >
                    <ArrowRight className="size-5" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-border bg-card/50 p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">{text}</p>
    </div>
  );
}
