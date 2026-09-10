import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { PawPrint, User, Baby, Network, ArrowRight } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/shared/ui/dialog";
import { useTranslation } from "@/shared/i18n";
import { WizardProgress } from "./panel-ui";
// Relative, not through the @/domains/animals barrel — same reasoning as breeders/index.ts's own
// `export * from "../animals/services/breeder"`: that barrel also re-exports components which
// import @/domains/breeders, so pulling the whole animals barrel in from here would be circular.
import { markOnboardingComplete } from "../../animals/services/breeder";

// First-visit welcome for a newly-approved breeder — see docs discussion 2026-09-11 ("onboarding
// account setup flow"). Deliberately NOT a long tutorial: 4 short screens (what this panel is,
// public profile, dogs/litters/puppies, pedigrees & applications), skippable at every step, shown
// exactly once per kennel (organisations.onboarding_completed_at). The actual hands-on walkthrough
// is the "getting started" checklist on the Overview page (see getting-started-checklist.tsx) —
// this modal only sets expectations, it doesn't try to teach by itself.
export function WelcomeModal({ kennelId, open }: { kennelId: string; open: boolean }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);

  const steps: { icon: LucideIcon; titleKey: string; bodyKey: string }[] = [
    { icon: PawPrint, titleKey: "welcomeTitle", bodyKey: "welcomeBody" },
    { icon: User, titleKey: "profileTitle", bodyKey: "profileBody" },
    { icon: Baby, titleKey: "dogsLittersTitle", bodyKey: "dogsLittersBody" },
    { icon: Network, titleKey: "pedigreesTitle", bodyKey: "pedigreesBody" },
  ];
  const stepTitles = steps.map((s) => t(`breederPanel.onboarding.${s.titleKey}`));
  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  async function finish() {
    setSaving(true);
    try {
      await markOnboardingComplete(kennelId);
    } finally {
      setSaving(false);
      setDismissed(true);
    }
  }

  return (
    <Dialog
      open={open && !dismissed}
      onOpenChange={(next) => {
        // The X button and Escape both route through here — treat either the same as "Skip"
        // (mark done, close) rather than leaving a controlled dialog stuck with no close handler.
        if (!next) finish();
      }}
    >
      <DialogContent className="rounded-3xl sm:max-w-md">
        <WizardProgress steps={stepTitles} current={step} />

        <div className="flex flex-col items-center py-4 text-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-8" />
          </div>
          {/* Radix requires a real Title/Description for a11y; the visible heading below is
              styled as the actual UI, these stay screen-reader-only so both needs are met without
              a duplicate-looking heading. */}
          <DialogTitle className="sr-only">
            {t(`breederPanel.onboarding.${current.titleKey}`)}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t(`breederPanel.onboarding.${current.bodyKey}`)}
          </DialogDescription>
          <h2 aria-hidden className="mt-4 font-display text-xl font-bold">
            {t(`breederPanel.onboarding.${current.titleKey}`)}
          </h2>
          <p aria-hidden className="mt-2 text-sm text-muted-foreground">
            {t(`breederPanel.onboarding.${current.bodyKey}`)}
          </p>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={finish}
            className="text-muted-foreground"
          >
            {t("breederPanel.onboarding.skip")}
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
            className="ml-auto h-12 flex-1 rounded-2xl text-base font-bold"
          >
            {isLast ? (
              t("breederPanel.onboarding.done")
            ) : (
              <>
                {t("breederPanel.onboarding.next")} <ArrowRight className="ml-1 size-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
