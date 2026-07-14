import { createFileRoute, Link } from "@tanstack/react-router";
import { breeders } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/buyer/followed")({
  component: FollowedBreeders,
});

function FollowedBreeders() {
  const followed = breeders.slice(0, 3);
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Followed breeders</h1>
        <p className="text-sm text-muted-foreground">You'll be notified when they publish new litters.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {followed.map((b) => (
          <div key={b.id} className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <img src={b.cover} alt="" className="aspect-[16/9] w-full object-cover" />
            <div className="p-4">
              <div className="font-display text-lg font-semibold">{b.kennel}</div>
              <div className="text-sm text-muted-foreground">{b.city}, {b.country}</div>
              <div className="mt-4 flex gap-2">
                <Button asChild size="sm" variant="outline"><Link to="/breeders/$slug" params={{ slug: b.slug }}>View kennel</Link></Button>
                <Button size="sm" variant="ghost">Unfollow</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
