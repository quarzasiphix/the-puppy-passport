import { createFileRoute, Link } from "@tanstack/react-router";
import { Truck, ArrowRight, Package, Zap, Crown, Info, Star } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getPublicTransportRating } from "@/domains/transport";
import { useTranslation } from "@/shared/i18n";
import transportImg from "@/assets/transport.jpg";

export const Route = createFileRoute("/_public/transport/")({
  head: () => ({ meta: [{ title: "Transport services — Anemalo" }] }),
  loader: async () => {
    const supabase = getSupabaseBrowserClient();
    const [{ data }, rating] = await Promise.all([
      supabase
        .from("public_transport_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6),
      getPublicTransportRating().catch(() => null),
    ]);
    return { publicRequests: data ?? [], rating };
  },
  component: TransportPage,
});

const categories = [
  { icon: Package, key: "shared" },
  { icon: Truck, key: "individual" },
  { icon: Zap, key: "express" },
  { icon: Crown, key: "vip" },
] as const;

function TransportPage() {
  const { publicRequests, rating } = Route.useLoaderData();
  const { t } = useTranslation();
  return (
    <div>
      <section className="border-b border-border/60 bg-secondary/40">
        <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-accent">
              {t("transportPage.eyebrow")}
            </p>
            <h1 className="mt-2 font-display text-3xl font-medium sm:text-5xl">
              {t("transportPage.title")}
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">{t("transportPage.intro")}</p>
            {rating && (rating.review_count ?? 0) > 0 && (
              <div className="mt-3 flex items-center gap-1.5 text-sm">
                <Star className="size-4 fill-warning text-warning" />
                <span className="font-medium">{rating.average_rating}</span>
                <span className="text-muted-foreground">
                  {t("transportPage.ratingFrom")} {rating.review_count}{" "}
                  {rating.review_count === 1
                    ? t("transportPage.ratingTransportSingular")
                    : t("transportPage.ratingTransportPlural")}
                </span>
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild size="lg">
                <Link to="/transport/request">{t("transportPage.requestTransport")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/planned-routes">{t("transportPage.viewPlannedRoutes")}</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link to="/estimate">{t("transportPage.getEstimate")}</Link>
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-3xl border border-border/70">
            <img
              src={transportImg}
              alt={t("transportPage.imageAlt")}
              className="aspect-[4/3] size-full object-cover"
            />
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => {
            const title = t(`transportPage.categories.${c.key}Title`);
            return (
              <div
                key={c.key}
                className="flex flex-col rounded-2xl border border-border/70 bg-card p-6"
              >
                <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <c.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
                <p className="text-xs uppercase tracking-wide text-accent">
                  {t(`transportPage.categories.${c.key}Tagline`)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(`transportPage.categories.${c.key}Desc`)}
                </p>
                <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />{" "}
                      {t(`transportPage.categories.${c.key}Benefit${i}`)}
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" className="mt-6">
                  <Link to="/transport/request">
                    {t("transportPage.requestPrefix")} {title.toLowerCase()}
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-border/70 bg-secondary/50 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>{t("transportPage.indicativeNote")}</span>
        </div>
      </section>

      {publicRequests.length > 0 && (
        <section className="border-t border-border/60 bg-secondary/40 py-14">
          <div className="container-page">
            <h2 className="mb-6 font-display text-2xl font-medium">
              {t("transportPage.communityRequestsTitle")}
            </h2>
            <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
              {t("transportPage.communityRequestsDesc")}
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {publicRequests.map((req) => (
                <div key={req.id} className="rounded-2xl border border-border/70 bg-card p-5">
                  <div className="flex items-center gap-2 text-sm">
                    {req.pickup_country ?? "?"}
                    {req.pickup_area_approx ? ` · ${req.pickup_area_approx}` : ""}
                    <ArrowRight className="mx-1 size-4 text-muted-foreground" />
                    {req.destination_country ?? "?"}
                    {req.destination_area_approx ? ` · ${req.destination_area_approx}` : ""}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="capitalize">
                      {req.requested_service_type?.replace("_", " ")}
                    </Badge>
                    {req.breed_free_text && (
                      <Badge variant="secondary">{req.breed_free_text}</Badge>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    {req.earliest_date
                      ? `${t("transportPage.fromDate")} ${new Date(
                          req.earliest_date,
                        ).toLocaleDateString("en-GB")}`
                      : t("transportPage.flexibleDate")}
                    {req.flexible_dates ? ` · ${t("transportPage.flexibleSuffix")}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="container-page pb-16 pt-14">
        <div className="rounded-3xl border border-border/70 bg-primary p-10 text-primary-foreground">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h3 className="font-display text-3xl font-medium">{t("transportPage.ctaTitle")}</h3>
              <p className="mt-1 text-primary-foreground/80">{t("transportPage.ctaDesc")}</p>
            </div>
            <Button asChild size="lg" variant="secondary">
              <Link to="/transport/request">
                <Truck className="mr-1 size-4" /> {t("transportPage.requestTransport")}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
