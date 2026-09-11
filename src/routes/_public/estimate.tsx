import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { Truck, Info } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { useAuth } from "@/domains/identity";
import { calculateEstimate, type PricingBreakdown } from "@/domains/transport";
import { findLikelyRouteMatch } from "@/domains/transport";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/_public/estimate")({
  head: () => ({ meta: [{ title: "Transport price estimate — Anemalo" }] }),
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
  const { t } = useTranslation();
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
          {t("estimatePage.eyebrow")}
        </p>
        <h1 className="mt-1 font-display text-4xl font-medium">{t("estimatePage.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("estimatePage.subtitle")}</p>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-8 space-y-4 rounded-2xl border border-border/70 bg-card p-6"
        >
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("estimatePage.pickupCountry")}
              </Label>
              <Input {...form.register("pickupCountry")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("estimatePage.destinationCountry")}
              </Label>
              <Input {...form.register("destinationCountry")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("estimatePage.animalSize")}
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
                  <SelectItem value="small">{t("estimatePage.sizeSmall")}</SelectItem>
                  <SelectItem value="medium">{t("estimatePage.sizeMedium")}</SelectItem>
                  <SelectItem value="large">{t("estimatePage.sizeLarge")}</SelectItem>
                  <SelectItem value="giant">{t("estimatePage.sizeGiant")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("estimatePage.service")}
              </Label>
              <Select
                value={form.watch("serviceType")}
                onValueChange={(v) => form.setValue("serviceType", v as FormValues["serviceType"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommend_best">
                    {t("estimatePage.serviceRecommend")}
                  </SelectItem>
                  <SelectItem value="shared">{t("estimatePage.serviceShared")}</SelectItem>
                  <SelectItem value="individual">
                    {t("estimatePage.serviceIndividual")}
                  </SelectItem>
                  <SelectItem value="express">{t("estimatePage.serviceExpress")}</SelectItem>
                  <SelectItem value="vip">{t("estimatePage.serviceVip")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? t("estimatePage.calculating") : t("estimatePage.getEstimate")}
          </Button>
        </form>

        {result && (
          <div className="mt-6 rounded-2xl border border-border/70 bg-card p-6">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("estimatePage.estimatedRange")}
            </div>
            <div className="mt-1 font-display text-3xl font-semibold">
              {result.currency} {result.low} – {result.high}
            </div>
            {routeMatch && (
              <p className="mt-2 text-sm text-success">{t("estimatePage.routeMatch")}</p>
            )}
            <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
              <li className="flex items-start gap-1.5">
                <Info className="mt-0.5 size-3 shrink-0" /> {t("estimatePage.note1")}
              </li>
              <li className="flex items-start gap-1.5">
                <Info className="mt-0.5 size-3 shrink-0" /> {t("estimatePage.note2")}
              </li>
              <li className="flex items-start gap-1.5">
                <Info className="mt-0.5 size-3 shrink-0" /> {t("estimatePage.note3")}
              </li>
            </ul>
            <div className="mt-5 flex gap-2">
              <Button asChild>
                <Link
                  to="/transport/request"
                  search={{
                    pickupCountry: form.getValues("pickupCountry"),
                    destinationCountry: form.getValues("destinationCountry"),
                    sizeCategory: form.getValues("sizeCategory"),
                    serviceType: form.getValues("serviceType"),
                  }}
                >
                  {t("estimatePage.continueFullRequest")}
                </Link>
              </Button>
              {!isSignedIn && (
                <Button asChild variant="outline">
                  <Link to="/signup">{t("estimatePage.createAccount")}</Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
