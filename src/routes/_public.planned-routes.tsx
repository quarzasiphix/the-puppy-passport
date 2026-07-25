import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Route as RouteIcon, ArrowRight, Truck, Bell, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAuth } from "@/hooks/use-auth";
import { joinRouteWaitlist } from "@/lib/queries/routes";

export const Route = createFileRoute("/_public/planned-routes")({
  head: () => ({ meta: [{ title: "Planned routes — Havenpaw" }] }),
  loader: async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from("public_routes")
      .select("*")
      .order("departure_date", { ascending: true, nullsFirst: false });
    return { routes: data ?? [] };
  },
  component: PlannedRoutesPage,
});

function PlannedRoutesPage() {
  const { routes } = Route.useLoaderData();

  return (
    <div className="container-page py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-accent">Planned routes</p>
          <h1 className="mt-1 font-display text-4xl font-medium">
            Upcoming shared transport routes
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            A professional schedule of planned journeys — approximate regions and dates only. Exact
            stops, addresses and vehicle details are confirmed privately once your request is
            accepted.
          </p>
        </div>
        <WaitlistDialog />
      </header>

      {routes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
          <RouteIcon className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No planned routes are open right now.
          </p>
          <Button asChild className="mt-4">
            <Link to="/transport/request">Request transport</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {routes.map((r) => (
            <div
              key={r.id}
              className="flex flex-col rounded-2xl border border-border/70 bg-card p-5"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                {r.origin_country ?? r.origin_region ?? "?"}
                <ArrowRight className="size-4 text-muted-foreground" />
                {(r.destination_countries ?? []).join(", ") ||
                  (r.destination_regions ?? []).join(", ") ||
                  "?"}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="secondary">{r.route_number}</Badge>
                <Badge variant="secondary" className="capitalize">
                  {r.status}
                </Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <dt>Departure</dt>
                  <dd className="font-medium text-foreground">
                    {r.departure_date
                      ? new Date(r.departure_date).toLocaleDateString("en-GB")
                      : "Flexible"}
                  </dd>
                </div>
                <div>
                  <dt>Places</dt>
                  <dd className="font-medium text-foreground">
                    {(r.available_capacity ?? 0) > 0
                      ? `${r.available_capacity} may be available`
                      : "Likely full"}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-col gap-2">
                <Button asChild size="sm">
                  <Link to="/transport/request">
                    <Truck className="mr-1 size-4" /> Request a place
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/transport/request">Request individual / express / VIP instead</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WaitlistDialog() {
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [earliestDate, setEarliestDate] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      joinRouteWaitlist({
        profileId: userId!,
        originCountry: origin,
        destinationCountry: destination,
        earliestDate: earliestDate || null,
      }),
    onSuccess: () => setSubmitted(true),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not join waitlist."),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setSubmitted(false);
          setOrigin("");
          setDestination("");
          setEarliestDate("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Bell className="mr-1 size-4" /> Don't see your route? Join the waitlist
        </Button>
      </DialogTrigger>
      <DialogContent>
        {!userId ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              <Link to="/signin" className="text-primary hover:underline">
                Sign in
              </Link>{" "}
              to join a route waitlist.
            </p>
          </div>
        ) : submitted ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto size-8 text-success" />
            <p className="mt-3 font-medium">You're on the list</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll let you know if a route matching this gets planned. This isn't a confirmed
              transport — you can still request transport directly any time.
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Join the route waitlist</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>From</Label>
                  <Input
                    placeholder="e.g. Poland"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                  />
                </div>
                <div>
                  <Label>To</Label>
                  <Input
                    placeholder="e.g. Spain"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Earliest you'd need it (optional)</Label>
                <Input
                  type="date"
                  value={earliestDate}
                  onChange={(e) => setEarliestDate(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={!origin.trim() || !destination.trim() || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                Join waitlist
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
