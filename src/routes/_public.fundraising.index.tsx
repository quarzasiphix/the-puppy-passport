import { createFileRoute, Link } from "@tanstack/react-router";
import { HeartHandshake } from "lucide-react";
import { listPublicCampaigns } from "@/lib/queries/fundraising";
import { FUNDRAISING_ENABLED } from "@/lib/fundraising-flag";
import { FundraisingDisabledNotice } from "@/components/fundraising-disabled-notice";
import { EmptyState } from "@/components/public/empty-state";

export const Route = createFileRoute("/_public/fundraising/")({
  head: () => ({ meta: [{ title: "Support animal transport — Havenpaw" }] }),
  loader: () => (FUNDRAISING_ENABLED ? listPublicCampaigns() : Promise.resolve([])),
  component: FundraisingListPage,
});

function FundraisingListPage() {
  const campaigns = Route.useLoaderData();

  return (
    <div className="container-page py-10">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">
          Verified-organisation fundraising
        </p>
        <h1 className="mt-1 font-display text-3xl font-medium">
          Help an animal reach its new home
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Campaigns are run only by verified foundations, shelters and rescue organisations, always
          tied to a real animal, a real transport request and an accepted quotation — never to fund
          buying an animal.
        </p>
      </header>

      {!FUNDRAISING_ENABLED ? (
        <FundraisingDisabledNotice />
      ) : campaigns.length === 0 ? (
        <EmptyState icon={HeartHandshake} title="No active campaigns right now" />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              to="/fundraising/$id"
              params={{ id: c.id }}
              className="rounded-2xl border border-border/70 bg-card p-5 hover:bg-secondary/40"
            >
              <div className="font-display text-lg font-semibold">{c.title}</div>
              <div className="text-sm text-muted-foreground">
                {c.organisationName} — {c.animalName}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${Math.min(100, (c.amountCollected / Math.max(c.targetAmount, 1)) * 100)}%`,
                  }}
                />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {c.amountCollected} / {c.targetAmount} {c.currency} collected
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
