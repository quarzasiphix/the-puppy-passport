import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { Truck, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { calculateEstimate, type PricingBreakdown } from "@/lib/queries/pricing";
import { findLikelyRouteMatch } from "@/lib/queries/transport";

export const Route = createFileRoute("/_public/estimate")({
  head: () => ({ meta: [{ title: "Transport price estimate — Havenpaw" }] }),
  component: EstimatePage,
});

type FormValues = {
  pickupCountry: string;
  destinationCountry: string;
  sizeCategory: "small" | "medium" | "large" | "giant";
  serviceType: "shared" | "individual" | "express" | "vip" | "recommend_best";
};

function EstimatePage() {
  const { isSignedIn } = useAuth();
  const [result, setResult] = useState<PricingBreakdown | null>(null);
  const [routeMatch, setRouteMatch] = useState(false);
  const [loading, setLoading] = useState(false);
  const form = useForm<FormValues>({
    defaultValues: {
      pickupCountry: "Poland",
      destinationCountry: "Netherlands",
      sizeCategory: "medium",
      serviceType: "recommend_best",
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const [estimate, match] = await Promise.all([
        calculateEstimate(values),
        findLikelyRouteMatch(values.destinationCountry),
      ]);
      setResult(estimate);
      setRouteMatch(!!match);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">
          Free, no account needed
        </p>
        <h1 className="mt-1 font-display text-4xl font-medium">
          Get an approximate transport price
        </h1>
        <p className="mt-2 text-muted-foreground">
          A quick estimate — no sign-up required. This is not a confirmed quotation.
        </p>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-8 space-y-4 rounded-2xl border border-border/70 bg-card p-6"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Pickup country
              </Label>
              <Input {...form.register("pickupCountry")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Destination country
              </Label>
              <Input {...form.register("destinationCountry")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Animal size
              </Label>
              <Select
                value={form.watch("sizeCategory")}
                onValueChange={(v) =>
                  form.setValue("sizeCategory", v as FormValues["sizeCategory"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                  <SelectItem value="giant">Giant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Service
              </Label>
              <Select
                value={form.watch("serviceType")}
                onValueChange={(v) => form.setValue("serviceType", v as FormValues["serviceType"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommend_best">Recommend best</SelectItem>
                  <SelectItem value="shared">Shared</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="express">Express</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Calculating…" : "Get estimate"}
          </Button>
        </form>

        {result && (
          <div className="mt-6 rounded-2xl border border-border/70 bg-card p-6">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Estimated range
            </div>
            <div className="mt-1 font-display text-3xl font-semibold">
              {result.currency} {result.low} – {result.high}
            </div>
            {routeMatch && (
              <p className="mt-2 text-sm text-success">
                A planned shared route already heads that way — this may reduce the price.
              </p>
            )}
            <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
              <li className="flex items-start gap-1.5">
                <Info className="mt-0.5 size-3 shrink-0" /> This is an estimated range, not a
                confirmed quotation.
              </li>
              <li className="flex items-start gap-1.5">
                <Info className="mt-0.5 size-3 shrink-0" /> The final price depends on exact route,
                dates, documents and operational review.
              </li>
              <li className="flex items-start gap-1.5">
                <Info className="mt-0.5 size-3 shrink-0" /> No transport has been reserved yet.
              </li>
            </ul>
            <div className="mt-5 flex gap-2">
              <Button asChild>
                <Link to="/transport/request">Continue with full request</Link>
              </Button>
              {!isSignedIn && (
                <Button asChild variant="outline">
                  <Link to="/signup">Create an account</Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
