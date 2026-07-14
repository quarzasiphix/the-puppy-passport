import { createFileRoute, Link } from "@tanstack/react-router";
import { puppies, savedPuppies } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard/buyer/saved")({
  component: SavedPuppies,
});

function SavedPuppies() {
  const saved = puppies.filter((p) => savedPuppies.includes(p.id));
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">Saved puppies</h1>
        <p className="text-sm text-muted-foreground">Puppies you're keeping an eye on.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {saved.map((p) => (
          <Link key={p.id} to="/puppies/$id" params={{ id: p.id }} className="overflow-hidden rounded-2xl border border-border/70 bg-card transition-colors hover:bg-secondary/40">
            <img src={p.image} alt="" className="aspect-[4/3] w-full object-cover" />
            <div className="p-4">
              <div className="font-display text-lg font-semibold">{p.name}</div>
              <div className="text-sm text-muted-foreground">{p.breed} · {p.kennel}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
