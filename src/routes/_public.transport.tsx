import { createFileRoute, Link } from "@tanstack/react-router";
import { Truck, ArrowRight, Package, Zap, Crown, Info, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getPublicTransportRating } from "@/lib/queries/transport";
import transportImg from "@/assets/transport.jpg";

export const Route = createFileRoute("/_public/transport")({
  head: () => ({ meta: [{ title: "Transport services — Havenpaw" }] }),
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
  {
    icon: Package,
    title: "Shared",
    tagline: "For flexible dates",
    desc: "Several compatible transport requests are connected into one planned route.",
    benefits: [
      "Lower price",
      "Planned European routes",
      "Flexible pickup window",
      "Regular status updates",
      "Suitable separation of unrelated animals",
    ],
  },
  {
    icon: Truck,
    title: "Individual",
    tagline: "One dedicated journey",
    desc: "A transport planned specifically for one customer or one related group of animals.",
    benefits: [
      "Dedicated planning",
      "Direct pickup and handover",
      "Agreed date",
      "Fewer route adjustments",
      "Individual communication",
    ],
  },
  {
    icon: Zap,
    title: "Express",
    tagline: "Priority request",
    desc: "A priority transport request, reviewed and quoted first.",
    benefits: [
      "Priority quotation",
      "Earliest available departure",
      "Shortened waiting time",
      "Direct operational contact",
      "Expedited planning",
    ],
  },
  {
    icon: Crown,
    title: "VIP",
    tagline: "Premium dedicated service",
    desc: "A premium dedicated service focused on privacy, scheduling and communication.",
    benefits: [
      "Dedicated vehicle or section",
      "Custom pickup schedule",
      "Premium communication",
      "Additional photo and status updates",
      "Individual handover arrangements",
    ],
  },
];

function TransportPage() {
  const { publicRequests, rating } = Route.useLoaderData();
  return (
    <div>
      <section className="border-b border-border/60 bg-secondary/40">
        <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-accent">
              Transport services
            </p>
            <h1 className="mt-2 font-display text-5xl font-medium">
              Four transport categories, one professional standard
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              All categories meet the same legal and animal-welfare requirements. VIP means privacy,
              scheduling and communication — not a higher minimum standard of care; every animal we
              transport travels in a suitable crate with water, ventilation and required breaks.
            </p>
            {rating && rating.review_count > 0 && (
              <div className="mt-3 flex items-center gap-1.5 text-sm">
                <Star className="size-4 fill-warning text-warning" />
                <span className="font-medium">{rating.average_rating}</span>
                <span className="text-muted-foreground">
                  from {rating.review_count} completed{" "}
                  {rating.review_count === 1 ? "transport" : "transports"}
                </span>
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild size="lg">
                <Link to="/transport/request">Request transport</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/planned-routes">View planned routes</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link to="/estimate">Just want a price? Get a free estimate</Link>
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-3xl border border-border/70">
            <img
              src={transportImg}
              alt="Transport crate loaded into a van"
              className="aspect-[4/3] size-full object-cover"
            />
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => (
            <div
              key={c.title}
              className="flex flex-col rounded-2xl border border-border/70 bg-card p-6"
            >
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <c.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold">{c.title}</h3>
              <p className="text-xs uppercase tracking-wide text-accent">{c.tagline}</p>
              <p className="mt-2 text-sm text-muted-foreground">{c.desc}</p>
              <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                {c.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" /> {b}
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="mt-6">
                <Link to="/transport/request">Request {c.title.toLowerCase()}</Link>
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-border/70 bg-secondary/50 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Prices and delivery windows are indicative until your request has been reviewed — final
            eligibility, route and price are confirmed after document and route review.
          </span>
        </div>
      </section>

      {publicRequests.length > 0 && (
        <section className="border-t border-border/60 bg-secondary/40 py-14">
          <div className="container-page">
            <h2 className="mb-6 font-display text-2xl font-medium">Community-visible requests</h2>
            <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
              Customers can choose to make a transport request visible to the community, for example
              to look for a shared route. Exact addresses and personal details are never shown.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {publicRequests.map((t) => (
                <div key={t.id} className="rounded-2xl border border-border/70 bg-card p-5">
                  <div className="flex items-center gap-2 text-sm">
                    {t.pickup_country ?? "?"}
                    {t.pickup_area_approx ? ` · ${t.pickup_area_approx}` : ""}
                    <ArrowRight className="mx-1 size-4 text-muted-foreground" />
                    {t.destination_country ?? "?"}
                    {t.destination_area_approx ? ` · ${t.destination_area_approx}` : ""}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="capitalize">
                      {t.requested_service_type?.replace("_", " ")}
                    </Badge>
                    {t.breed_free_text && <Badge variant="secondary">{t.breed_free_text}</Badge>}
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    {t.earliest_date
                      ? `From ${new Date(t.earliest_date).toLocaleDateString("en-GB")}`
                      : "Flexible date"}
                    {t.flexible_dates ? " · flexible" : ""}
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
              <h3 className="font-display text-3xl font-medium">Ready to plan a journey?</h3>
              <p className="mt-1 text-primary-foreground/80">
                Submit a request — takes a few minutes, subject to review.
              </p>
            </div>
            <Button asChild size="lg" variant="secondary">
              <Link to="/transport/request">
                <Truck className="mr-1 size-4" /> Request transport
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
