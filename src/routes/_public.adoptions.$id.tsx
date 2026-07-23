import { useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft,
  MapPin,
  ShieldCheck,
  Truck,
  HeartHandshake,
  MessageCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getAdoptionById } from "@/lib/queries/marketplace";
import { useAuth } from "@/hooks/use-auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ReportDialog } from "@/components/report-dialog";
import { startApplicationConversation } from "@/lib/queries/messaging";
import { foundationOrgTypeLabel } from "@/components/cards";

export const Route = createFileRoute("/_public/adoptions/$id")({
  loader: async ({ params }) => {
    const animal = await getAdoptionById(params.id).catch(() => null);
    if (!animal) throw notFound();
    return animal;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} — ${loaderData.breed} — Adoption — Havenpaw`
          : "Adoption — Havenpaw",
      },
      {
        name: "description",
        content: loaderData
          ? `${loaderData.name}, a ${loaderData.breed} looking for a new home from ${loaderData.orgName} in ${loaderData.city}, ${loaderData.country}.`
          : "A dog looking for a new home on Havenpaw.",
      },
    ],
  }),
  component: AdoptionDetail,
});

function AdoptionDetail() {
  const a = Route.useLoaderData();
  const { userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);

  const existingApplicationQuery = useQuery({
    queryKey: ["my-adoption-application", a.id, userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("buyer_applications")
        .select("id")
        .eq("animal_id", a.id)
        .eq("buyer_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const alreadyApplied = submitted || !!existingApplicationQuery.data;

  const messageMutation = useMutation({
    mutationFn: () => startApplicationConversation(a.id),
    onSuccess: (conversationId) => {
      navigate({ to: "/dashboard/buyer/messages", search: { conversation: conversationId } });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not open conversation."),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("buyer_applications").insert({
        animal_id: a.id,
        buyer_id: userId!,
        organization_id: a.orgId || null,
        application_type: a.category === "private_rehoming" ? "rehoming_inquiry" : "adoption",
        message: message || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Interest sent.");
      queryClient.invalidateQueries({ queryKey: ["my-adoption-application", a.id, userId] });
    },
    onError: (err) => {
      if (err instanceof Error && err.message.includes("duplicate")) {
        toast.error("You've already expressed interest in this dog.");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not send — please try again.");
    },
  });

  return (
    <div className="container-page py-10">
      <Link
        to="/adoptions"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> All dogs for adoption
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="overflow-hidden rounded-2xl bg-secondary">
            <img
              src={a.gallery[activePhoto] ?? a.image}
              alt={a.name}
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
          {a.gallery.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pt-3">
              {a.gallery.map((g, i) => (
                <button
                  key={g + i}
                  type="button"
                  onClick={() => setActivePhoto(i)}
                  aria-label={`Photo ${i + 1} of ${a.gallery.length} of ${a.name}`}
                  aria-pressed={activePhoto === i}
                  className={`aspect-square w-20 shrink-0 overflow-hidden rounded-lg border-2 ${
                    activePhoto === i ? "border-primary" : "border-transparent"
                  }`}
                >
                  <img src={g} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-medium">{a.name}</h1>
              {a.category === "private_rehoming" ? (
                <Badge variant="secondary">Private rehoming</Badge>
              ) : (
                a.verified && (
                  <Badge className="border-primary/30 bg-primary/90 text-primary-foreground">
                    <ShieldCheck className="mr-1 size-3" /> Verified{" "}
                    {(a.orgType ? foundationOrgTypeLabel[a.orgType] : "organisation").toLowerCase()}
                  </Badge>
                )
              )}
              {a.transportAvailable && (
                <Badge variant="secondary">
                  <Truck className="mr-1 size-3" /> Transport available
                </Badge>
              )}
            </div>
            <p className="mt-1 text-muted-foreground">
              {a.breed} · {a.sex} · {a.approxAge}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-3.5" /> {a.city}, {a.country}
            </p>

            {a.description && (
              <div className="mt-6">
                <h2 className="font-display text-lg font-semibold">Their story</h2>
                <p className="mt-2 text-sm text-muted-foreground">{a.description}</p>
              </div>
            )}
            {a.temperament && (
              <div className="mt-4">
                <h2 className="font-display text-lg font-semibold">Temperament</h2>
                <p className="mt-2 text-sm text-muted-foreground">{a.temperament}</p>
              </div>
            )}
            {a.idealHome && (
              <div className="mt-4">
                <h2 className="font-display text-lg font-semibold">Ideal home</h2>
                <p className="mt-2 text-sm text-muted-foreground">{a.idealHome}</p>
              </div>
            )}
            <div className="mt-6">
              <ReportDialog
                targetType="animal_listing"
                targetId={a.id}
                triggerLabel="Report this listing"
              />
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            {a.category === "private_rehoming" || !a.orgSlug ? (
              <h2 className="font-display text-lg font-semibold">{a.orgName}</h2>
            ) : (
              <Link
                to="/foundations/$slug"
                params={{ slug: a.orgSlug }}
                className="font-display text-lg font-semibold hover:underline"
              >
                {a.orgName}
              </Link>
            )}
            {a.adoptionFee != null && (
              <p className="mt-2 text-sm">
                {a.category === "private_rehoming" ? "Rehoming fee" : "Adoption fee"}:{" "}
                <span className="font-medium">
                  {a.adoptionFee.toLocaleString()} {a.currency}
                </span>
              </p>
            )}

            {!userId ? (
              <div className="mt-4 rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground">
                <Link to="/signin" className="text-primary hover:underline">
                  Sign in
                </Link>{" "}
                {a.category === "private_rehoming"
                  ? `to ask about rehoming ${a.name}.`
                  : `to express interest in adopting ${a.name}.`}
              </div>
            ) : existingApplicationQuery.isLoading ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
            ) : alreadyApplied ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-start gap-2 rounded-xl bg-success/10 p-3 text-sm text-success">
                  <HeartHandshake className="mt-0.5 size-4 shrink-0" />
                  <p>
                    {a.category === "private_rehoming"
                      ? `Your message has been sent to ${a.orgName}. They'll follow up directly — this isn't a confirmed handover yet.`
                      : `Your interest has been sent to ${a.orgName}. They'll follow up directly — this isn't a confirmed adoption yet.`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={messageMutation.isPending}
                  onClick={() => messageMutation.mutate()}
                >
                  <MessageCircle className="mr-1 size-4" /> Message {a.orgName}
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <label htmlFor="adoption-interest-message" className="text-sm font-medium">
                  Tell them a little about yourself (optional)
                </label>
                <Textarea
                  id="adoption-interest-message"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Your home situation, experience with dogs…"
                />
                <Button
                  className="w-full"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate()}
                >
                  {a.category === "private_rehoming"
                    ? `Ask about rehoming ${a.name}`
                    : `I'm interested in adopting ${a.name}`}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {a.category === "private_rehoming"
                    ? `This sends a first message to ${a.orgName} — they'll ask any further questions directly before agreeing to a handover.`
                    : `This sends a first message to ${a.orgName} — they'll ask any further questions directly before confirming an adoption.`}
                </p>
              </div>
            )}
          </div>

          {a.transportAvailable && (
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex items-center gap-2">
                <Truck className="size-4 text-primary" />
                <h2 className="font-display text-base font-semibold">Transport</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {a.orgName} can arrange transport for {a.name} once{" "}
                {a.category === "private_rehoming"
                  ? "the handover is agreed"
                  : "your adoption is approved"}{" "}
                — it's never booked automatically, and the exact pickup/delivery address stays
                private until you submit a transport request.
              </p>
              <Button asChild variant="outline" className="mt-3 w-full">
                <Link to="/transport/request" search={{ animalId: a.id }}>
                  Check transport options
                </Link>
              </Button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
