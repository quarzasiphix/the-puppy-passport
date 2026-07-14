import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ShieldCheck, Star, Truck, MessageCircle, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { breeders, puppies, plannedLitters, parents } from "@/lib/mock-data";
import { PuppyCard, LitterCard } from "@/components/cards";

export const Route = createFileRoute("/_public/breeders/$slug")({
  component: BreederProfile,
});

function BreederProfile() {
  const { slug } = useParams({ from: "/_public/breeders/$slug" });
  const b = breeders.find((x) => x.slug === slug) ?? breeders[0];
  const kPuppies = puppies.filter((p) => p.breederId === b.id);
  const kPlanned = plannedLitters.filter((l) => l.breederId === b.id);

  return (
    <div>
      <div className="relative h-64 bg-secondary md:h-80">
        <img src={b.cover} alt="" className="size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      <div className="container-page -mt-24 pb-16">
        <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start gap-6">
            <img src={b.logo} alt="" className="size-24 rounded-2xl border-4 border-background object-cover shadow-md" />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-medium">{b.kennel}</h1>
                {b.verified && (
                  <Badge className="bg-primary/90 text-primary-foreground">
                    <ShieldCheck className="mr-1 size-3" /> Verified
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-muted-foreground">
                {b.name} · <MapPin className="mr-1 inline size-3.5" />{b.city}, {b.country}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {b.breeds.map((br) => (
                  <Badge key={br} variant="secondary">{br}</Badge>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-6 text-sm">
                <Stat label="Rating" value={<><Star className="inline size-4 text-warning" /> {b.rating} ({b.reviewCount})</>} />
                <Stat label="Experience" value={`${b.years} years`} />
                <Stat label="Successful handovers" value={String(b.handovers)} />
                <Stat label="Association" value={b.association} />
                <Stat label="Response time" value={b.responseTime} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="lg"><MessageCircle className="mr-1 size-4" /> Contact breeder</Button>
              <Button size="lg" variant="outline">Follow kennel</Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="about" className="mt-8">
          <TabsList className="w-full flex-wrap justify-start">
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="puppies">Current puppies</TabsTrigger>
            <TabsTrigger value="planned">Planned litters</TabsTrigger>
            <TabsTrigger value="parents">Parent dogs</TabsTrigger>
            <TabsTrigger value="health">Health & living</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="transport">Transport</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
          </TabsList>

          <TabsContent value="about" className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <h3 className="mb-3 font-display text-xl font-semibold">About the kennel</h3>
              <p className="text-muted-foreground">{b.description}</p>
              <p className="mt-3 text-muted-foreground">
                We aim to raise puppies that are stable, healthy and well-prepared for family or
                sport life. Every buyer is welcome to visit before deciding.
              </p>
            </Card>
            <Card>
              <h3 className="mb-3 font-display text-xl font-semibold">Application rules</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>· Applications reviewed within 48 hours</li>
                <li>· Video call before reservation</li>
                <li>· Visit encouraged before puppy leaves home</li>
                <li>· Take-back guarantee for the life of the dog</li>
              </ul>
            </Card>
          </TabsContent>

          <TabsContent value="puppies" className="mt-6">
            {kPuppies.length ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {kPuppies.map((p) => <PuppyCard key={p.id} p={p} />)}
              </div>
            ) : (
              <Card><p className="text-muted-foreground">No puppies available right now — check planned litters.</p></Card>
            )}
          </TabsContent>

          <TabsContent value="planned" className="mt-6">
            {kPlanned.length ? (
              <div className="grid gap-6 lg:grid-cols-2">
                {kPlanned.map((l) => <LitterCard key={l.id} l={l} planned />)}
              </div>
            ) : (
              <Card><p className="text-muted-foreground">No planned litters yet.</p></Card>
            )}
          </TabsContent>

          <TabsContent value="parents" className="mt-6 grid gap-6 md:grid-cols-2">
            {[parents.mother, parents.father].map((p, i) => (
              <Card key={i}>
                <div className="flex gap-4">
                  <img src={p.image} alt="" className="size-24 rounded-xl object-cover" />
                  <div>
                    <div className="text-xs uppercase tracking-wide text-accent">{i === 0 ? "Mother" : "Father"}</div>
                    <h4 className="mt-1 font-display text-lg font-semibold">{p.name}</h4>
                    <p className="text-xs text-muted-foreground">{p.pedigree}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="health" className="mt-6 grid gap-6 md:grid-cols-2">
            <Card>
              <h3 className="mb-3 font-display text-xl font-semibold">Health testing approach</h3>
              <p className="text-muted-foreground">
                All parents pass hip and elbow scoring, annual eye tests and breed-specific DNA
                panels before being bred. Results are available on request.
              </p>
            </Card>
            <Card>
              <h3 className="mb-3 font-display text-xl font-semibold">Living conditions</h3>
              <p className="text-muted-foreground">
                Puppies are raised inside our home from birth. They experience household sounds,
                garden play, car rides and different surfaces before leaving.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="reviews" className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              { name: "Julia P.", years: "2 yrs ago", text: "Anna was incredibly patient and answered every question. Our girl is exactly the puppy she described." },
              { name: "Kai M.", years: "1 yr ago", text: "Professional handover, all documents in order. Transport to Berlin was smooth." },
              { name: "Ola R.", years: "3 yrs ago", text: "Home-raised puppies, socialised beautifully. Still in touch with the breeder years later." },
              { name: "Léa V.", years: "6 mo ago", text: "Communication, information accuracy and puppy condition were all excellent." },
            ].map((r) => (
              <Card key={r.name}>
                <div className="mb-2 flex items-center gap-1 text-warning">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-4 fill-current" />)}
                </div>
                <p className="text-sm text-muted-foreground">"{r.text}"</p>
                <p className="mt-3 text-xs font-medium">{r.name} — {r.years}</p>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="transport" className="mt-6">
            <Card>
              <div className="flex items-start gap-4">
                <Truck className="size-6 text-primary" />
                <div>
                  <h3 className="font-display text-xl font-semibold">Transport we've arranged</h3>
                  <p className="mt-1 text-muted-foreground">
                    We regularly coordinate shared transport to Germany, Austria and the Netherlands.
                    Individual transport is also possible on request.
                  </p>
                  <Button asChild variant="outline" className="mt-4">
                    <Link to="/transport">See transport options</Link>
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="contact" className="mt-6">
            <Card>
              <h3 className="mb-3 font-display text-xl font-semibold">Contact & application rules</h3>
              <p className="text-muted-foreground">
                All first contact happens through Havenpaw. After the breeder approves your
                application, direct contact details are shared.
              </p>
              <Button className="mt-4">Send message</Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border/70 bg-card p-6 ${className}`}>{children}</div>;
}
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
