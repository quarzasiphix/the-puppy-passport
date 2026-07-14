import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "./dashboard.breeder.index";
import { breeders } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard/breeder/profile")({
  component: ProfilePreview,
});

function ProfilePreview() {
  const b = breeders[0];
  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium">Public profile</h1>
          <p className="text-sm text-muted-foreground">How buyers see your kennel on Havenpaw.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Edit</Button>
          <Button asChild><Link to="/breeders/$slug" params={{ slug: b.slug }}>View live profile</Link></Button>
        </div>
      </header>
      <Card title="Preview">
        <div className="overflow-hidden rounded-xl border border-border/70">
          <img src={b.cover} alt="" className="h-40 w-full object-cover" />
          <div className="p-4">
            <div className="font-display text-lg font-semibold">{b.kennel}</div>
            <div className="text-xs text-muted-foreground">{b.city}, {b.country} · ★ {b.rating} · {b.reviewCount} reviews</div>
            <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{b.description}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
