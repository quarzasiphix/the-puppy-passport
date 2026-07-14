import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, SlidersHorizontal, Map, LayoutGrid, List, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { puppies } from "@/lib/mock-data";
import { PuppyCard } from "@/components/cards";

export const Route = createFileRoute("/_public/find-a-dog")({
  head: () => ({
    meta: [
      { title: "Find a dog — Havenpaw" },
      { name: "description", content: "Browse puppies from verified European breeders." },
    ],
  }),
  component: FindADog,
});

function FindADog() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [price, setPrice] = useState([2000, 12000]);
  return (
    <div className="container-page py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">Find a dog</h1>
          <p className="text-sm text-muted-foreground">
            Showing {puppies.length} puppies from verified breeders across Europe
          </p>
        </div>
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search breed, kennel, city…" className="pl-9" />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl border border-border/70 bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <SlidersHorizontal className="size-4" /> Filters
            </h2>
            <button className="text-xs text-muted-foreground hover:text-foreground">Reset</button>
          </div>

          <FilterGroup title="Breed">
            <Select defaultValue="all">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All breeds</SelectItem>
                <SelectItem value="gr">Golden Retriever</SelectItem>
                <SelectItem value="bc">Border Collie</SelectItem>
                <SelectItem value="lab">Labrador Retriever</SelectItem>
                <SelectItem value="gsd">German Shepherd</SelectItem>
                <SelectItem value="ber">Bernese Mountain Dog</SelectItem>
                <SelectItem value="frb">French Bulldog</SelectItem>
              </SelectContent>
            </Select>
          </FilterGroup>

          <FilterGroup title="Country">
            <Select defaultValue="pl">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pl">Poland</SelectItem>
                <SelectItem value="de">Germany</SelectItem>
                <SelectItem value="nl">Netherlands</SelectItem>
                <SelectItem value="cz">Czech Republic</SelectItem>
                <SelectItem value="all">All Europe</SelectItem>
              </SelectContent>
            </Select>
          </FilterGroup>

          <FilterGroup title="Region">
            <Input placeholder="e.g. Mazowieckie" />
          </FilterGroup>

          <FilterGroup title="Distance (km)">
            <Slider defaultValue={[500]} max={2000} step={50} />
            <p className="mt-1 text-xs text-muted-foreground">Within 500 km</p>
          </FilterGroup>

          <CheckList
            title="Availability"
            items={["Available now", "Planned litter", "Applications open"]}
            defaults={[0]}
          />
          <CheckList title="Sex" items={["Male", "Female"]} />

          <FilterGroup title={`Price (PLN) — ${price[0].toLocaleString()} – ${price[1].toLocaleString()}`}>
            <Slider value={price} onValueChange={setPrice} min={1000} max={20000} step={100} />
          </FilterGroup>

          <FilterGroup title="Collection-ready from">
            <Input type="date" />
          </FilterGroup>

          <CheckList
            title="Verification & pedigree"
            items={[
              "ZKwP / FCI registered",
              "Health-tested parents",
              "Verified breeders only",
            ]}
            defaults={[2]}
          />
          <CheckList title="Transport" items={["Domestic transport", "International transport"]} />
          <CheckList
            title="Intended purpose"
            items={["Family companion", "Sport", "Exhibition", "Breeding"]}
          />
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3">
            <div className="text-sm text-muted-foreground">
              <strong className="text-foreground">{puppies.length}</strong> results
            </div>
            <div className="flex items-center gap-2">
              <Select defaultValue="newest">
                <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Sort: Newest</SelectItem>
                  <SelectItem value="ready">Sort: Collection date</SelectItem>
                  <SelectItem value="price">Sort: Price</SelectItem>
                  <SelectItem value="distance">Sort: Distance</SelectItem>
                </SelectContent>
              </Select>
              <Separator orientation="vertical" className="h-6" />
              <Button
                size="sm"
                variant={view === "grid" ? "default" : "ghost"}
                onClick={() => setView("grid")}
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button
                size="sm"
                variant={view === "list" ? "default" : "ghost"}
                onClick={() => setView("list")}
              >
                <List className="size-4" />
              </Button>
              <Button size="sm" variant="outline">
                <Map className="mr-1 size-4" /> Map view
              </Button>
            </div>
          </div>

          {view === "grid" ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {puppies.map((p) => (
                <PuppyCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {puppies.map((p) => (
                <Link
                  key={p.id}
                  to="/puppies/$id"
                  params={{ id: p.id }}
                  className="grid gap-4 rounded-2xl border border-border/70 bg-card p-3 transition-colors hover:bg-secondary/40 md:grid-cols-[180px_1fr_auto]"
                >
                  <img src={p.image} alt={p.name} className="aspect-[4/3] w-full rounded-xl object-cover" />
                  <div className="flex flex-col gap-2 py-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl font-semibold">{p.name}</h3>
                      <Badge variant="secondary">{p.breed}</Badge>
                      <Badge variant="secondary">{p.sex}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{p.about}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> {p.city}, {p.country}</span>
                      <span className="inline-flex items-center gap-1"><Calendar className="size-3" /> Ready {new Date(p.readyDate).toLocaleDateString("en-GB")}</span>
                      <span>{p.kennel}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between py-1 pr-3">
                    <div className="text-right">
                      <div className="font-display text-lg font-semibold">
                        {p.pricePLN.toLocaleString()} PLN
                      </div>
                      <div className="text-xs text-muted-foreground">≈ €{p.priceEUR.toLocaleString()}</div>
                    </div>
                    <Button size="sm">View puppy</Button>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-10 grid gap-4 rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-6 md:grid-cols-3">
            <EmptyStateSample title="No results (example)" desc="Try widening the distance or removing filters." />
            <EmptyStateSample title="Loading (example)" desc="Fetching listings from verified kennels…" spinner />
            <EmptyStateSample title="Empty section (example)" desc="No planned litters for this breed yet." />
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <Label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </Label>
      {children}
    </div>
  );
}

function CheckList({
  title,
  items,
  defaults = [],
}: {
  title: string;
  items: string[];
  defaults?: number[];
}) {
  return (
    <div className="mb-5">
      <Label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </Label>
      <div className="space-y-2">
        {items.map((i, idx) => (
          <label key={i} className="flex items-center gap-2 text-sm">
            <Checkbox defaultChecked={defaults.includes(idx)} /> {i}
          </label>
        ))}
      </div>
    </div>
  );
}

function EmptyStateSample({ title, desc, spinner }: { title: string; desc: string; spinner?: boolean }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-4 text-center">
      {spinner && (
        <div className="mx-auto mb-2 size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      )}
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
    </div>
  );
}
