import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Compass } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { listPublishedPuppies, type PuppyWithExtras } from "@/domains/marketplace";
import { PuppyCard } from "@/domains/marketplace";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/_public/find-your-dog")({
  head: () => ({
    meta: [
      { title: "Find your ideal dog — Anemalo" },
      {
        name: "description",
        content: "A short guided search to narrow down available puppies to what fits your home.",
      },
    ],
  }),
  component: FindYourDogPage,
});

type SizeCategory = "small" | "medium" | "large" | "giant";

function getSizeOptions(
  t: (key: string) => string,
): { value: SizeCategory; label: string; hint: string }[] {
  return [
    { value: "small", label: t("findYourDog.sizeSmallLabel"), hint: t("findYourDog.sizeSmallHint") },
    {
      value: "medium",
      label: t("findYourDog.sizeMediumLabel"),
      hint: t("findYourDog.sizeMediumHint"),
    },
    { value: "large", label: t("findYourDog.sizeLargeLabel"), hint: t("findYourDog.sizeLargeHint") },
    { value: "giant", label: t("findYourDog.sizeGiantLabel"), hint: t("findYourDog.sizeGiantHint") },
  ];
}

type Answers = {
  size: SizeCategory | "any";
  country: string | "any";
  transportNeeded: boolean | null;
  maxBudgetEUR: number | null;
};

async function listBreedSizes() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("breeds").select("name, size_category");
  if (error) throw error;
  return (data ?? []) as { name: string; size_category: SizeCategory }[];
}

const steps = ["size", "location", "transport", "budget", "results"] as const;

function FindYourDogPage() {
  const { t } = useTranslation();
  const sizeOptions = getSizeOptions(t);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    size: "any",
    country: "any",
    transportNeeded: null,
    maxBudgetEUR: null,
  });

  const puppiesQuery = useQuery({
    queryKey: ["all-published-puppies"],
    queryFn: () => listPublishedPuppies(),
  });
  const breedSizesQuery = useQuery({ queryKey: ["breed-sizes"], queryFn: listBreedSizes });

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const p of puppiesQuery.data ?? []) if (p.country) set.add(p.country);
    return Array.from(set).sort();
  }, [puppiesQuery.data]);

  const matches = useMemo(() => {
    if (!puppiesQuery.data) return [];
    const sizeByBreed = new Map((breedSizesQuery.data ?? []).map((b) => [b.name, b.size_category]));
    return puppiesQuery.data.filter((p: PuppyWithExtras) => {
      if (answers.size !== "any" && sizeByBreed.get(p.breed) !== answers.size) return false;
      if (answers.country !== "any" && p.country !== answers.country) return false;
      if (answers.transportNeeded === true && !p.transportAvailable) return false;
      if (answers.maxBudgetEUR != null && p.priceEUR > answers.maxBudgetEUR) return false;
      return p.status !== "sold" && p.status !== "draft";
    });
  }, [puppiesQuery.data, breedSizesQuery.data, answers]);

  const step = steps[stepIndex];
  const isLoading = puppiesQuery.isLoading || breedSizesQuery.isLoading;

  function next() {
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }
  function back() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <div className="container-page max-w-2xl py-10">
      <header className="mb-8 text-center">
        <Compass className="mx-auto size-8 text-primary" />
        <h1 className="mt-3 font-display text-3xl font-medium">{t("findYourDog.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("findYourDog.subtitle")}</p>
      </header>

      {step !== "results" && (
        <div className="mb-6 flex justify-center gap-1.5">
          {steps.slice(0, -1).map((s, i) => (
            <span
              key={s}
              className={`h-1.5 w-8 rounded-full ${i <= stepIndex ? "bg-primary" : "bg-secondary"}`}
            />
          ))}
        </div>
      )}

      {step === "size" && (
        <StepCard title={t("findYourDog.sizeStepTitle")}>
          <div className="grid grid-cols-2 gap-3">
            {sizeOptions.map((o) => (
              <OptionButton
                key={o.value}
                selected={answers.size === o.value}
                onClick={() => {
                  setAnswers({ ...answers, size: o.value });
                  next();
                }}
              >
                <div className="font-medium">{o.label}</div>
                <div className="text-xs text-muted-foreground">{o.hint}</div>
              </OptionButton>
            ))}
          </div>
          <button
            className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              setAnswers({ ...answers, size: "any" });
              next();
            }}
          >
            {t("findYourDog.noPreference")}
          </button>
        </StepCard>
      )}

      {step === "location" && (
        <StepCard title={t("findYourDog.locationStepTitle")} onBack={back}>
          <div className="grid grid-cols-2 gap-3">
            {countries.map((c) => (
              <OptionButton
                key={c}
                selected={answers.country === c}
                onClick={() => {
                  setAnswers({ ...answers, country: c });
                  next();
                }}
              >
                {c}
              </OptionButton>
            ))}
          </div>
          <button
            className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              setAnswers({ ...answers, country: "any" });
              next();
            }}
          >
            {t("findYourDog.anyCountry")}
          </button>
        </StepCard>
      )}

      {step === "transport" && (
        <StepCard title={t("findYourDog.transportStepTitle")} onBack={back}>
          <div className="grid grid-cols-2 gap-3">
            <OptionButton
              selected={answers.transportNeeded === true}
              onClick={() => {
                setAnswers({ ...answers, transportNeeded: true });
                next();
              }}
            >
              {t("findYourDog.transportYes")}
            </OptionButton>
            <OptionButton
              selected={answers.transportNeeded === false}
              onClick={() => {
                setAnswers({ ...answers, transportNeeded: false });
                next();
              }}
            >
              {t("findYourDog.transportNo")}
            </OptionButton>
          </div>
        </StepCard>
      )}

      {step === "budget" && (
        <StepCard title={t("findYourDog.budgetStepTitle")} onBack={back}>
          <div className="grid grid-cols-2 gap-3">
            {[1000, 1500, 2000, 3000].map((b) => (
              <OptionButton
                key={b}
                selected={answers.maxBudgetEUR === b}
                onClick={() => {
                  setAnswers({ ...answers, maxBudgetEUR: b });
                  next();
                }}
              >
                {t("findYourDog.upToPrefix")} €{b.toLocaleString()}
              </OptionButton>
            ))}
          </div>
          <button
            className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              setAnswers({ ...answers, maxBudgetEUR: null });
              next();
            }}
          >
            {t("findYourDog.noBudgetLimit")}
          </button>
        </StepCard>
      )}

      {step === "results" && (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold">
                {isLoading
                  ? t("findYourDog.searching")
                  : `${t("findYourDog.matchingPuppies")}: ${matches.length}`}
              </h2>
              <p className="text-sm text-muted-foreground">{t("findYourDog.basedOnListings")}</p>
            </div>
            <Button variant="outline" onClick={() => setStepIndex(0)}>
              {t("findYourDog.startOver")}
            </Button>
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("findYourDog.loading")}</p>
          ) : matches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
              <p className="font-medium">{t("findYourDog.noMatchesTitle")}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {t("findYourDog.noMatchesDesc")}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {matches.map((p) => (
                <PuppyCard key={p.id} p={p} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepCard({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6">
      {onBack && (
        <button
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" /> {t("findYourDog.back")}
        </button>
      )}
      <h2 className="mb-4 font-display text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between rounded-xl border p-4 text-left text-sm transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border/70 hover:border-primary/50 hover:bg-secondary/40"
      }`}
    >
      <div>{children}</div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
