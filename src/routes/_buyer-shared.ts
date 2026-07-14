import { createFileRoute, Link } from "@tanstack/react-router";
import { puppies, savedPuppies, breeders, buyerApplications, reservations, transportRequests } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function PageWrap({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">{title}</h1>
        {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
      </header>
      {children}
    </div>
  );
}

export const SavedRoute = createFileRoute("/dashboard/buyer/saved")({
  component: () => {
    const saved = puppies.filter((p) => savedPuppies.includes(p.id));
    return (
      <PageWrap title="Saved puppies" desc="Puppies you're keeping an eye on.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {saved.map((p) => (
            <Link key={p.id} to="/puppies/$id" params={{ id: p.id }} className="overflow-hidden rounded-2xl border border-border/70 bg-card">
              <img src={p.image} alt="" className="aspect-[4/3] w-full object-cover" />
              <div className="p-4">
                <div className="font-display text-lg font-semibold">{p.name}</div>
                <div className="text-sm text-muted-foreground">{p.breed} · {p.kennel}</div>
              </div>
            </Link>
          ))}
        </div>
      </PageWrap>
    );
  },
});
