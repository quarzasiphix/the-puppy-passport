import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { litters } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard/breeder/litters")({
  component: LittersPage,
});

function LittersPage() {
  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium">Litters</h1>
          <p className="text-sm text-muted-foreground">Manage current and planned litters.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Add planned litter</Button>
          <Button><Plus className="mr-1 size-4" /> Add litter</Button>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-4">Litter</th>
              <th className="p-4">Breed</th>
              <th className="p-4">Parents</th>
              <th className="p-4">Born</th>
              <th className="p-4">Ready</th>
              <th className="p-4">Puppies</th>
              <th className="p-4">Status</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {litters.map((l) => (
              <tr key={l.id} className="hover:bg-secondary/40">
                <td className="p-4 font-medium">{l.code}</td>
                <td className="p-4">{l.breed}</td>
                <td className="p-4 text-muted-foreground">{l.mother} × {l.father}</td>
                <td className="p-4">{new Date(l.birthDate).toLocaleDateString("en-GB")}</td>
                <td className="p-4">{new Date(l.readyDate).toLocaleDateString("en-GB")}</td>
                <td className="p-4">{l.puppyCount} <span className="text-xs text-muted-foreground">({l.available} avail · {l.reserved} res)</span></td>
                <td className="p-4"><Badge variant="secondary">Published</Badge></td>
                <td className="p-4 text-right">
                  <Link to="/dashboard/breeder/litters/$id" params={{ id: l.id }} className="text-primary hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
