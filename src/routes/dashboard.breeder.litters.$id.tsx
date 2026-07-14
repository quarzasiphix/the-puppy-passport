import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { litters, puppies, parents } from "@/lib/mock-data";
import { Card } from "./dashboard.breeder.index";

export const Route = createFileRoute("/dashboard/breeder/litters/$id")({
  component: LitterDetail,
});

function LitterDetail() {
  const { id } = useParams({ from: "/dashboard/breeder/litters/$id" });
  const l = litters.find((x) => x.id === id) ?? litters[0];
  const kPuppies = puppies.filter((p) => p.litterId === l.id);
  return (
    <div>
      <Link to="/dashboard/breeder/litters" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> All litters
      </Link>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">{l.code}</h1>
          <p className="text-sm text-muted-foreground">
            {l.breed} · Born {new Date(l.birthDate).toLocaleDateString("en-GB")} · Ready {new Date(l.readyDate).toLocaleDateString("en-GB")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Edit litter</Button>
          <Button>Add puppy</Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card title="Puppies in this litter">
          <ul className="grid gap-3 md:grid-cols-2">
            {kPuppies.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border/70 bg-background p-3">
                <img src={p.image} alt="" className="size-16 rounded-lg object-cover" />
                <div className="flex-1">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.sex} · {p.color}</div>
                </div>
                <Badge variant="secondary" className="capitalize">{p.status.replace("-", " ")}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card title="Shared parent info">
            <ul className="space-y-2 text-sm">
              <li><strong>Mother:</strong> {parents.mother.name} <span className="text-xs text-muted-foreground">({parents.mother.pedigree})</span></li>
              <li><strong>Father:</strong> {parents.father.name} <span className="text-xs text-muted-foreground">({parents.father.pedigree})</span></li>
              <li><strong>Registration:</strong> {l.registration}</li>
              <li><strong>Litter size:</strong> {l.puppyCount}</li>
            </ul>
          </Card>
          <Card title="Shared documents">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✓ Parent health tests (HD, ED, eyes)</li>
              <li>✓ Pedigree registration certificate</li>
              <li>✓ Vet check certificate</li>
              <li>✓ Litter photos (14 uploaded)</li>
            </ul>
          </Card>
          <p className="rounded-xl border border-dashed border-border/70 p-3 text-xs text-muted-foreground">
            All puppies in this litter inherit the shared parent, pedigree and document information.
          </p>
        </div>
      </div>
    </div>
  );
}
