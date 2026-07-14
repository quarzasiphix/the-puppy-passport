import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { puppies } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard/breeder/puppies")({
  component: PuppiesPage,
});

function PuppiesPage() {
  const extra = [
    { ...puppies[0], id: "px1", name: "Draft — Puppy #7", status: "draft" as const },
    { ...puppies[1], id: "px2", name: "Not listed — Puppy #3", status: "sold" as const },
  ];
  const all = [...puppies, ...extra];
  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium">Puppies</h1>
          <p className="text-sm text-muted-foreground">Manage individual puppy listings.</p>
        </div>
        <Button><Plus className="mr-1 size-4" /> Add puppy</Button>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {all.map((p) => (
          <article key={p.id} className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <img src={p.image} alt="" className="aspect-[4/3] w-full object-cover" />
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-lg font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.breed} · {p.sex}</div>
                </div>
                <Badge variant="secondary" className="capitalize">{p.status.replace("-", " ")}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline">Edit</Button>
                <Button size="sm" variant="outline">Publish</Button>
                <Button size="sm" variant="outline">Applications</Button>
                <Button size="sm" variant="outline">Mark reserved</Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
