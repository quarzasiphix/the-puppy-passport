import { Link } from "@tanstack/react-router";
import { Truck, Search, Dog, HeartHandshake, Users, Home, ArrowRight } from "lucide-react";
import { useAuth } from "@/domains/identity";
import { useTranslation } from "@/shared/i18n";

// The single "what can I do here" launcher, shown on the homepage and the customer dashboard.
// Six actions only — no sub-categories up front. Each card links straight into the correct flow
// (an already-approved breeder/foundation skips the application step); the user never needs to
// understand Anemalo's internal role model to get moving.
export function ActionLauncher({ variant = "homepage" }: { variant?: "homepage" | "dashboard" }) {
  const { roles, isSignedIn } = useAuth();
  const { t } = useTranslation();
  const isBreeder = roles.some((r) => r.role === "breeder" && r.status === "active");
  const isFoundation = roles.some(
    (r) => (r.role === "foundation_member" || r.role === "shelter_member") && r.status === "active",
  );

  const actions = [
    {
      to: isBreeder ? "/dashboard/breeder/puppies" : "/create-breeder",
      search: isBreeder ? undefined : ({ type: "kennel" } as const),
      icon: Dog,
      title: t("actionLauncher.publishAnimalTitle"),
      desc: isBreeder
        ? t("actionLauncher.publishAnimalDescActive")
        : t("actionLauncher.publishAnimalDescInactive"),
    },
    {
      to: isFoundation ? "/dashboard/foundation/animals" : "/create-breeder",
      search: isFoundation ? undefined : ({ type: "foundation" } as const),
      icon: HeartHandshake,
      title: t("actionLauncher.publishAdoptionTitle"),
      desc: isFoundation
        ? t("actionLauncher.publishAdoptionDescActive")
        : t("actionLauncher.publishAdoptionDescInactive"),
    },
    {
      to: "/find-a-dog",
      search: undefined,
      icon: Search,
      title: t("actionLauncher.findDogTitle"),
      desc: t("actionLauncher.findDogDesc"),
    },
    {
      to: "/breeders",
      search: undefined,
      icon: Users,
      title: t("actionLauncher.findBreederTitle"),
      desc: t("actionLauncher.findBreederDesc"),
    },
    {
      to: "/rehome",
      search: undefined,
      icon: Home,
      title: t("actionLauncher.rehomeTitle"),
      desc: t("actionLauncher.rehomeDesc"),
    },
  ] as const;

  return (
    <section className={variant === "homepage" ? "container-page py-16" : "mb-8"}>
      {variant === "homepage" && (
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wider text-accent">
            {t("actionLauncher.getStarted")}
          </p>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-tight md:text-4xl">
            {t("actionLauncher.title")}
          </h2>
        </div>
      )}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Link
          to="/transport/request"
          className="group flex flex-col justify-between rounded-2xl border border-primary/30 bg-primary p-6 text-primary-foreground transition-transform hover:-translate-y-0.5 md:col-span-3 md:flex-row md:items-center"
        >
          <div className="flex items-center gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-foreground/15">
              <Truck className="size-6" />
            </div>
            <div>
              <div className="font-display text-xl font-semibold">
                {t("actionLauncher.requestTransport")}
              </div>
              <div className="text-sm text-primary-foreground/80">
                {isSignedIn
                  ? t("actionLauncher.requestTransportDescSignedIn")
                  : t("actionLauncher.requestTransportDescSignedOut")}
              </div>
            </div>
          </div>
          <ArrowRight className="mt-4 size-5 shrink-0 md:mt-0" />
        </Link>

        {actions.map((a) => (
          <Link
            key={a.title}
            to={a.to}
            search={a.search}
            className="flex flex-col rounded-2xl border border-border/70 bg-card p-5 transition-colors hover:bg-secondary/40"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <a.icon className="size-5" />
            </div>
            <div className="mt-3 font-display text-lg font-semibold">{a.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{a.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
