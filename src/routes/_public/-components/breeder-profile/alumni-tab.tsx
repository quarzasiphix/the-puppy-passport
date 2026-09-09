import { Home } from "lucide-react";
import { EmptyState } from "./empty-state";
import type { Puppies } from "./types";

// Alumni is a new concept — a permanent record of puppies this kennel has placed, not a rotating
// "for sale" grid. It needs to read differently from the Puppies tab, not just show the same
// PuppyCard with a badge stuck on top:
//  - An intro line states what this section is (once, above the grid) so a first-time visitor
//    understands "permanent history" without reading the empty-state copy.
//  - The photo gets a warm, slightly desaturated treatment (full color on hover) instead of the
//    marketplace card's crisp "for sale" presentation — visually signalling "this chapter is
//    closed", not "buy me".
//  - The status pill moves to a bottom-left placement with a heart icon and reads "Found a home"
//    — distinct from the Puppies tab's top-left availability-status pill, so the two tabs are
//    never visually interchangeable at a glance.
// No new data is used — only fields already on the mapped Puppy (name/breed/sex/image), so nothing
// here fabricates a placement date or similar that isn't actually loaded.
export function AlumniTab({ alumni, kennelName }: { alumni: Puppies; kennelName: string }) {
  if (alumni.length === 0) {
    return (
      <EmptyState icon={Home} title="No placed puppies yet">
        Every puppy {kennelName} places through Anemalo will stay listed here permanently as part of
        their history.
      </EmptyState>
    );
  }
  return (
    <div>
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-border/70 bg-secondary/30 p-4 text-sm text-muted-foreground">
        <Home className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          {alumni.length} {alumni.length === 1 ? "puppy" : "puppies"} from {kennelName} found their
          forever home through Anemalo. This is a permanent record, not a rotating gallery — nothing
          here is ever removed once a puppy is placed.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {alumni.map((p) => (
          <AlumniCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}

function AlumniCard({ p }: { p: Puppies[number] }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
        <img
          src={p.image}
          alt={p.name}
          loading="lazy"
          className="size-full object-cover grayscale-[20%] transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground backdrop-blur">
          <Home className="size-3 text-primary" /> Found a home
        </span>
      </div>
      <div className="p-4">
        <h4 className="font-display text-lg font-semibold">{p.name}</h4>
        <p className="text-sm text-muted-foreground">
          {p.breed} · {p.sex}
        </p>
      </div>
    </article>
  );
}
