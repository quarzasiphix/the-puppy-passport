import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/shared/ui/button";
import { ShieldCheck, FileCheck2, Stethoscope, HeartHandshake, Truck } from "lucide-react";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/_public/how-it-works")({
  head: () => ({ meta: [{ title: "How it works — Anemalo" }] }),
  component: HowItWorks,
});

function HowItWorks() {
  const { t } = useTranslation();
  const steps = [
    [t("howItWorksPage.step1Title"), t("howItWorksPage.step1Desc")],
    [t("howItWorksPage.step2Title"), t("howItWorksPage.step2Desc")],
    [t("howItWorksPage.step3Title"), t("howItWorksPage.step3Desc")],
    [t("howItWorksPage.step4Title"), t("howItWorksPage.step4Desc")],
    [t("howItWorksPage.step5Title"), t("howItWorksPage.step5Desc")],
  ];
  const trust = [
    {
      icon: ShieldCheck,
      label: t("howItWorksPage.trustVerifiedLabel"),
      desc: t("howItWorksPage.trustVerifiedDesc"),
    },
    {
      icon: FileCheck2,
      label: t("howItWorksPage.trustLittersLabel"),
      desc: t("howItWorksPage.trustLittersDesc"),
    },
    {
      icon: Stethoscope,
      label: t("howItWorksPage.trustHealthLabel"),
      desc: t("howItWorksPage.trustHealthDesc"),
    },
    {
      icon: HeartHandshake,
      label: t("howItWorksPage.trustApplicationsLabel"),
      desc: t("howItWorksPage.trustApplicationsDesc"),
    },
    {
      icon: Truck,
      label: t("howItWorksPage.trustTransportLabel"),
      desc: t("howItWorksPage.trustTransportDesc"),
    },
  ];
  return (
    <div>
      <section className="border-b border-border/60 bg-secondary/40 py-16">
        <div className="container-page max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-wider text-accent">
            {t("howItWorksPage.eyebrow")}
          </p>
          <h1 className="mt-2 font-display text-3xl font-medium sm:text-5xl">
            {t("howItWorksPage.title")}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("howItWorksPage.subtitle")}</p>
        </div>
      </section>

      <section className="container-page py-16">
        <h2 className="mb-8 font-display text-3xl font-medium">{t("howItWorksPage.stepsTitle")}</h2>
        <ol className="grid gap-4 md:grid-cols-5">
          {steps.map(([title, d], i) => (
            <li key={title} className="rounded-2xl border border-border/70 bg-card p-6">
              <div className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {i + 1}
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-border/60 bg-secondary/40 py-16">
        <div className="container-page">
          <h2 className="mb-8 font-display text-3xl font-medium">
            {t("howItWorksPage.verifyTitle")}
          </h2>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            {trust.map((item) => (
              <div key={item.label} className="rounded-2xl border border-border/70 bg-card p-6">
                <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{item.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="rounded-3xl border border-border/70 bg-card p-8 md:p-12">
          <h2 className="font-display text-3xl font-medium">{t("howItWorksPage.reviewsTitle")}</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">{t("howItWorksPage.reviewsDesc")}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/find-a-dog">{t("howItWorksPage.findYourDogCta")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/create-breeder">{t("howItWorksPage.imBreederCta")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
