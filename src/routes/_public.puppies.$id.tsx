import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import {
  MapPin, Calendar, ShieldCheck, Truck, Heart, MessageCircle, ChevronLeft, Check,
  Award, FileText, Syringe, Stethoscope, BadgeCheck, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { puppies, parents, litters, breeders } from "@/lib/mock-data";
import { ApplyDialog } from "@/components/apply-dialog";

export const Route = createFileRoute("/_public/puppies/$id")({
  component: PuppyDetail,
});

function PuppyDetail() {
  const { id } = useParams({ from: "/_public/puppies/$id" });
  const puppy = puppies.find((p) => p.id === id) ?? puppies[0];
  const litter = litters.find((l) => l.id === puppy.litterId) ?? litters[0];
  const breeder = breeders.find((b) => b.id === puppy.breederId) ?? breeders[0];
  const [active, setActive] = useState(0);
  const [openApply, setOpenApply] = useState(false);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="container-page py-6">
        <Link to="/find-a-dog" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> Back to results
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div>
            <div className="overflow-hidden rounded-3xl border border-border/70 bg-card">
              <div className="aspect-[4/3] bg-secondary">
                <img src={puppy.gallery[active]} alt={puppy.name} className="size-full object-cover" />
              </div>
              <div className="flex gap-2 p-3">
                {puppy.gallery.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    className={`aspect-square w-20 overflow-hidden rounded-lg border-2 ${active === i ? "border-primary" : "border-transparent"}`}
                  >
                    <img src={g} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <Tabs defaultValue="about" className="mt-8">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="about">About</TabsTrigger>
                <TabsTrigger value="litter">Litter</TabsTrigger>
                <TabsTrigger value="parents">Parents</TabsTrigger>
                <TabsTrigger value="health">Health & documents</TabsTrigger>
                <TabsTrigger value="breeder">Breeder</TabsTrigger>
                <TabsTrigger value="transport">Transport</TabsTrigger>
              </TabsList>

              <TabsContent value="about" className="mt-6 space-y-4">
                <SectionCard title="About the puppy">
                  <p className="text-muted-foreground">{puppy.about}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {[
                      ["Temperament", "Confident, curious, gentle"],
                      ["Current development", "Weaned, exploring outdoors"],
                      ["Socialisation", "People, children, calm dogs"],
                      ["Ideal home", "Active family with time to train"],
                    ].map(([t, d]) => (
                      <div key={t} className="rounded-xl border border-border/70 bg-background p-4">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">{t}</div>
                        <div className="mt-1 font-medium">{d}</div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </TabsContent>

              <TabsContent value="litter" className="mt-6">
                <SectionCard title="Litter information">
                  <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    {[
                      ["Litter", litter.code],
                      ["Born", new Date(litter.birthDate).toLocaleDateString("en-GB")],
                      ["Puppies", `${litter.puppyCount} (M/F mixed)`],
                      ["Available males", "2"],
                      ["Available females", "1"],
                      ["Registration", litter.registration],
                    ].map(([t, d]) => (
                      <div key={t as string}>
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t}</dt>
                        <dd className="mt-0.5 font-medium">{d}</dd>
                      </div>
                    ))}
                  </dl>
                </SectionCard>
              </TabsContent>

              <TabsContent value="parents" className="mt-6 grid gap-4 md:grid-cols-2">
                <ParentCard p={parents.mother} label="Mother" />
                <ParentCard p={parents.father} label="Father" />
              </TabsContent>

              <TabsContent value="health" className="mt-6">
                <SectionCard title="Health & documents">
                  <ul className="grid gap-3 md:grid-cols-2">
                    {[
                      { icon: BadgeCheck, label: "Microchip", done: true },
                      { icon: Syringe, label: "Vaccinations (age-appropriate)", done: true },
                      { icon: Stethoscope, label: "Deworming schedule", done: true },
                      { icon: FileText, label: "Health book / passport", done: true },
                      { icon: Award, label: "Pedigree / birth certificate", done: true },
                      { icon: FileText, label: "Sales agreement (template)", done: true },
                      { icon: Stethoscope, label: "Parent health tests (HD, ED, eyes)", done: true },
                    ].map((i) => (
                      <li key={i.label} className="flex items-center gap-3 rounded-xl border border-border/70 bg-background p-3">
                        <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                          <i.icon className="size-4" />
                        </span>
                        <span className="flex-1 text-sm font-medium">{i.label}</span>
                        {i.done && <Check className="size-4 text-success" />}
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              </TabsContent>

              <TabsContent value="breeder" className="mt-6">
                <SectionCard title="About the breeder">
                  <div className="flex items-start gap-4">
                    <img src={breeder.cover} alt="" className="size-24 rounded-xl object-cover" />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-display text-lg font-semibold">{breeder.kennel}</h4>
                        {breeder.verified && (
                          <Badge className="bg-primary/90 text-primary-foreground">
                            <ShieldCheck className="mr-1 size-3" /> Verified
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {breeder.name} · {breeder.city}, {breeder.country} · ★ {breeder.rating} ({breeder.reviewCount})
                      </p>
                      <p className="mt-2 text-sm">{breeder.description}</p>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Response: {breeder.responseTime}</span>
                        <span>{breeder.years} yrs experience</span>
                        <span>{breeder.handovers} handovers</span>
                      </div>
                      <Button asChild variant="outline" size="sm" className="mt-4">
                        <Link to="/breeders/$slug" params={{ slug: breeder.slug }}>
                          View kennel profile
                        </Link>
                      </Button>
                    </div>
                  </div>
                </SectionCard>
              </TabsContent>

              <TabsContent value="transport" className="mt-6">
                <SectionCard title="Transport estimate">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Destination
                      </label>
                      <Input placeholder="City, Country" defaultValue="Berlin, Germany" />
                    </div>
                    <Button>Estimate</Button>
                  </div>
                  <div className="mt-5 rounded-xl border border-border/70 bg-background p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Estimated price</div>
                        <div className="font-display text-xl font-semibold">€280 – €360</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Type</div>
                        <div className="font-medium">Shared or individual</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Next planned route</div>
                        <div className="font-medium">Warsaw → Berlin · 26 Jul</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Delivery period</div>
                        <div className="font-medium">1–2 days from pickup</div>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Visual example only. A full quote is prepared after your reservation.
                    </p>
                  </div>
                </SectionCard>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
              <div className="flex flex-wrap gap-1.5">
                <Badge className="bg-success/15 text-success">Available</Badge>
                {puppy.verified && (
                  <Badge className="bg-primary/90 text-primary-foreground">
                    <ShieldCheck className="mr-1 size-3" /> Verified breeder
                  </Badge>
                )}
              </div>
              <h1 className="mt-3 font-display text-3xl font-medium">{puppy.name}</h1>
              <p className="text-muted-foreground">{puppy.breed} · {puppy.sex} · {puppy.color}</p>

              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <Field icon={<Calendar className="size-4" />} label="Date of birth" value={new Date(puppy.dob).toLocaleDateString("en-GB")} />
                <Field icon={<Calendar className="size-4" />} label="Ready" value={new Date(puppy.readyDate).toLocaleDateString("en-GB")} />
                <Field icon={<MapPin className="size-4" />} label="Location" value={`${puppy.city}, ${puppy.country}`} />
                <Field icon={<Truck className="size-4" />} label="Transport" value="Available" />
              </dl>

              <Separator className="my-5" />

              <div>
                <div className="font-display text-3xl font-semibold">
                  {puppy.pricePLN.toLocaleString()} PLN
                </div>
                <div className="text-sm text-muted-foreground">≈ €{puppy.priceEUR.toLocaleString()}</div>
              </div>

              <div className="mt-5 space-y-2">
                <Button className="w-full" size="lg" onClick={() => setOpenApply(true)}>
                  Apply for this puppy
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="lg">
                    <MessageCircle className="mr-1 size-4" /> Ask breeder
                  </Button>
                  <Button variant="outline" size="lg" asChild>
                    <Link to="/transport/request">
                      <Truck className="mr-1 size-4" /> Transport
                    </Link>
                  </Button>
                </div>
                <Button variant="ghost" className="w-full">
                  <Heart className="mr-1 size-4" /> Save listing
                </Button>
              </div>

              <div className="mt-5 rounded-xl border border-border/70 bg-secondary/50 p-3 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    Havenpaw does not sell puppies directly. Applying opens a conversation with the
                    breeder, who decides who they place their puppies with.
                  </span>
                </div>
              </div>

              <div className="mt-5 border-t border-border/60 pt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Verification levels
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Email verified",
                    "Identity verified",
                    "Kennel verified",
                    "Association: ZKwP / FCI",
                    "Litter info confirmed",
                    "Health info provided",
                  ].map((v) => (
                    <Tooltip key={v}>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="cursor-help">
                          <ShieldCheck className="mr-1 size-3 text-primary" />
                          {v}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[220px]">
                        We independently confirmed this level. Hover any badge on our site for
                        details.
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
      <ApplyDialog open={openApply} onOpenChange={setOpenApply} puppyName={puppy.name} />
    </TooltipProvider>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-6">
      <h3 className="mb-4 font-display text-xl font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">{icon} {label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function ParentCard({ p, label }: { p: typeof parents.mother; label: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <img src={p.image} alt={p.name} className="aspect-[4/3] w-full object-cover" />
      <div className="p-5">
        <div className="text-xs uppercase tracking-wide text-accent">{label}</div>
        <h4 className="mt-1 font-display text-lg font-semibold">{p.name}</h4>
        <p className="text-xs text-muted-foreground">{p.pedigree}</p>
        <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.tests.map((t) => (
            <Badge key={t} variant="secondary">{t}</Badge>
          ))}
        </div>
        <p className="mt-3 text-sm"><strong>Titles: </strong>{p.titles}</p>
      </div>
    </div>
  );
}
