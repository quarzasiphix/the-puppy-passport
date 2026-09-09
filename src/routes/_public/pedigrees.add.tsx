import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Upload, PencilLine, Network, ChevronLeft, Check, UserPlus } from "lucide-react";

import {
  createPedigreeSubmission,
  uploadPedigreeSourceDocument,
  resolvePedigreeSlot,
  searchDogs,
  type DogSearchResult,
  type ManualAncestorEntry,
  type PedigreeParentRole,
  type PedigreeSourceType,
  type PedigreeSubmissionMethod,
} from "@/domains/pedigrees";
import { useAuth } from "@/domains/identity";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useTranslation } from "@/shared/i18n";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";

const searchSchema = z.object({ subject: z.string().optional() });

export const Route = createFileRoute("/_public/pedigrees/add")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Add a pedigree — Anemalo" },
      {
        name: "description",
        content:
          "Contribute a pedigree to the Anemalo public registry — upload a document or type the ancestors in.",
      },
    ],
  }),
  component: AddPedigree,
});

type Method = PedigreeSubmissionMethod;

// V1 ancestor slots: the subject's parents and grandparents (6 slots). Keeps the review stage
// usable on a phone; deeper generations can be added in a later pass without a schema change.
const ANCESTOR_SLOTS: { slotKey: string; role: PedigreeParentRole; label: string }[] = [
  { slotKey: "sire", role: "sire", label: "Sire (father)" },
  { slotKey: "dam", role: "dam", label: "Dam (mother)" },
  { slotKey: "sire.sire", role: "sire", label: "Sire's sire" },
  { slotKey: "sire.dam", role: "dam", label: "Sire's dam" },
  { slotKey: "dam.sire", role: "sire", label: "Dam's sire" },
  { slotKey: "dam.dam", role: "dam", label: "Dam's dam" },
];

type Draft = { registeredName: string; pedigreeNumber: string; sex?: "male" | "female" };

function emptyDraft(): Draft {
  return { registeredName: "", pedigreeNumber: "" };
}

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 w-8 rounded-full ${i <= step ? "bg-accent" : "bg-border"}`}
        />
      ))}
    </div>
  );
}

function AddPedigree() {
  const { t } = useTranslation();
  const { subject: subjectSlug } = Route.useSearch();
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<Method | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [contactEmail, setContactEmail] = useState("");
  const [subject, setSubject] = useState<Draft>(emptyDraft);
  const [ancestors, setAncestors] = useState<Record<string, Draft>>({});
  const [candidatesBySlot, setCandidatesBySlot] = useState<Record<string, DogSearchResult[]>>({});
  const [decisions, setDecisions] = useState<
    Record<string, { action: "use_existing" | "create_new" | "skip"; dogId?: string }>
  >({});
  const [result, setResult] = useState<{ submissionId: string } | null>(null);

  const sourceType: PedigreeSourceType =
    method === "upload" ? "uploaded_scan" : "community_contribution";

  const filledAncestors = useMemo(
    () =>
      ANCESTOR_SLOTS.map((s) => ({ slot: s, draft: ancestors[s.slotKey] }))
        .filter((x) => x.draft?.registeredName?.trim())
        .map<ManualAncestorEntry>((x) => ({
          slotKey: x.slot.slotKey,
          role: x.slot.role,
          registeredName: x.draft.registeredName.trim(),
          pedigreeNumber: x.draft.pedigreeNumber.trim() || undefined,
          sex: x.draft.sex,
        })),
    [ancestors],
  );

  const runMatching = useMutation({
    mutationFn: async () => {
      const out: Record<string, DogSearchResult[]> = {};
      for (const entry of filledAncestors) {
        const q = entry.pedigreeNumber || entry.registeredName;
        out[entry.slotKey] = q ? await searchDogs(q, 5) : [];
      }
      return out;
    },
    onSuccess: (out) => {
      setCandidatesBySlot(out);
      const seeded: typeof decisions = {};
      for (const entry of filledAncestors) {
        const top = out[entry.slotKey]?.[0];
        seeded[entry.slotKey] =
          top && (top.matchRank >= 90 || top.matchedOn.length > 0)
            ? { action: "use_existing", dogId: top.id }
            : { action: "create_new" };
      }
      setDecisions(seeded);
      setStep(3);
    },
    onError: (err) => toast.error(getFriendlyErrorMessage(err, t("pedigree.add.matchFailed"))),
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!isSignedIn && !contactEmail.trim()) {
        throw new Error(t("pedigree.add.emailRequired"));
      }
      const { submissionId } = await createPedigreeSubmission({
        method: method ?? "manual_entry",
        sourceType,
        subjectDogId: null,
        contactEmail: isSignedIn ? null : contactEmail.trim(),
        submittedOrgId: null,
        subjectDraft: {
          registeredName: subject.registeredName.trim(),
          pedigreeNumber: subject.pedigreeNumber.trim() || undefined,
          sex: subject.sex,
        },
        manualEntries: filledAncestors,
      });

      if (file) {
        await uploadPedigreeSourceDocument(submissionId, file).catch((err) => {
          // The submission row is already saved; a failed document attach should not lose it.
          console.warn("pedigree document upload failed", err);
        });
      }

      // Record the subject slot, then each ancestor decision. Signed-in contributors can record
      // resolutions immediately; an anonymous submission stores the manual entries and its
      // resolutions are applied by staff review (finalize is staff-only regardless).
      if (isSignedIn) {
        await resolvePedigreeSlot({
          submissionId,
          slotKey: "",
          role: null,
          action: "create_new",
          newDog: {
            registered_name: subject.registeredName.trim(),
            pedigree_number: subject.pedigreeNumber.trim() || undefined,
            sex: subject.sex,
          },
        });
        for (const entry of filledAncestors) {
          const decision = decisions[entry.slotKey];
          if (!decision) continue;
          await resolvePedigreeSlot({
            submissionId,
            slotKey: entry.slotKey,
            role: entry.role,
            action: decision.action,
            resolvedDogId: decision.action === "use_existing" ? decision.dogId : null,
            newDog:
              decision.action === "create_new"
                ? {
                    registered_name: entry.registeredName,
                    pedigree_number: entry.pedigreeNumber,
                    sex: entry.sex,
                  }
                : undefined,
          }).catch((err) => console.warn("slot resolve failed", entry.slotKey, err));
        }
      }

      return { submissionId };
    },
    onSuccess: (r) => setResult(r),
    onError: (err) => toast.error(getFriendlyErrorMessage(err, t("pedigree.add.submitFailed"))),
  });

  if (result) {
    return (
      <div className="container-page max-w-xl py-12">
        <div className="rounded-2xl border border-success/30 bg-success/10 p-6">
          <Check className="size-6 text-success" />
          <h1 className="mt-3 font-display text-2xl font-medium">{t("pedigree.add.doneTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("pedigree.add.doneBodyPending")}</p>
          {!isSignedIn && (
            <div className="mt-4 rounded-xl border border-border/70 bg-card p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <UserPlus className="size-4" /> {t("pedigree.add.createAccountPrompt")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("pedigree.add.createAccountBlurb")}
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/signup">{t("pedigree.add.createAccountCta")}</Link>
              </Button>
            </div>
          )}
          <Button variant="outline" className="mt-4" onClick={() => navigate({ to: "/pedigrees" })}>
            {t("pedigree.add.backToRegistry")}
          </Button>
        </div>
      </div>
    );
  }

  const canLeaveStep1 = method !== null;
  const canLeaveStep2 = subject.registeredName.trim().length > 1;

  return (
    <div className="container-page max-w-2xl py-10">
      <Link
        to="/pedigrees"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> {t("pedigree.search.backToSearch")}
      </Link>

      <header className="mt-3">
        <h1 className="font-display text-3xl font-medium">{t("pedigree.add.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("pedigree.add.subtitle")}</p>
        <div className="mt-4">
          <StepDots step={step} total={4} />
        </div>
      </header>

      {/* Step 1 — method */}
      {step === 0 && (
        <section className="mt-6 space-y-3">
          {(
            [
              {
                key: "upload",
                icon: Upload,
                title: t("pedigree.add.methodUpload"),
                blurb: t("pedigree.add.methodUploadBlurb"),
              },
              {
                key: "manual_entry",
                icon: PencilLine,
                title: t("pedigree.add.methodManual"),
                blurb: t("pedigree.add.methodManualBlurb"),
              },
              {
                key: "build_from_existing",
                icon: Network,
                title: t("pedigree.add.methodBuild"),
                blurb: t("pedigree.add.methodBuildBlurb"),
              },
            ] as const
          ).map(({ key, icon: Icon, title, blurb }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMethod(key)}
              className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                method === key
                  ? "border-accent bg-accent/5"
                  : "border-border/70 bg-card hover:border-accent/50"
              }`}
            >
              <Icon className="mt-0.5 size-5 text-accent" />
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs text-muted-foreground">{blurb}</span>
              </span>
            </button>
          ))}

          {method === "upload" && (
            <div className="rounded-2xl border border-border/70 bg-card p-4">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                {t("pedigree.add.ocrNotAvailable")}
              </p>
            </div>
          )}

          <Button className="mt-2" disabled={!canLeaveStep1} onClick={() => setStep(1)}>
            {t("pedigree.add.continue")}
          </Button>
        </section>
      )}

      {/* Step 2 — subject dog */}
      {step === 1 && (
        <section className="mt-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("pedigree.add.subjectHeading")}
          </h2>
          {subjectSlug && (
            <p className="text-[11px] text-muted-foreground">
              {t("pedigree.add.subjectFromDog").replace("{slug}", subjectSlug)}
            </p>
          )}
          <Input
            placeholder={t("pedigree.fields.registeredName")}
            value={subject.registeredName}
            onChange={(e) => setSubject((s) => ({ ...s, registeredName: e.target.value }))}
          />
          <Input
            placeholder={t("pedigree.fields.registrationNumber")}
            value={subject.pedigreeNumber}
            onChange={(e) => setSubject((s) => ({ ...s, pedigreeNumber: e.target.value }))}
          />
          <div className="flex gap-2">
            {(["male", "female"] as const).map((sx) => (
              <Button
                key={sx}
                type="button"
                variant={subject.sex === sx ? "default" : "outline"}
                size="sm"
                onClick={() => setSubject((s) => ({ ...s, sex: sx }))}
              >
                {t(`pedigree.sex.${sx}`)}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>
              {t("pedigree.add.back")}
            </Button>
            <Button disabled={!canLeaveStep2} onClick={() => setStep(2)}>
              {t("pedigree.add.continue")}
            </Button>
          </div>
        </section>
      )}

      {/* Step 3 — ancestors */}
      {step === 2 && (
        <section className="mt-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("pedigree.add.ancestorsHeading")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("pedigree.add.ancestorsBlurb")}</p>
          {ANCESTOR_SLOTS.map((slot) => {
            const d = ancestors[slot.slotKey] ?? emptyDraft();
            return (
              <div key={slot.slotKey} className="rounded-2xl border border-border/70 bg-card p-3">
                <div className="text-xs font-semibold text-foreground">{slot.label}</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Input
                    placeholder={t("pedigree.fields.registeredName")}
                    value={d.registeredName}
                    onChange={(e) =>
                      setAncestors((a) => ({
                        ...a,
                        [slot.slotKey]: { ...d, registeredName: e.target.value },
                      }))
                    }
                  />
                  <Input
                    placeholder={t("pedigree.fields.registrationNumber")}
                    value={d.pedigreeNumber}
                    onChange={(e) =>
                      setAncestors((a) => ({
                        ...a,
                        [slot.slotKey]: { ...d, pedigreeNumber: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
            );
          })}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              {t("pedigree.add.back")}
            </Button>
            <Button
              disabled={runMatching.isPending || filledAncestors.length === 0}
              onClick={() => runMatching.mutate()}
            >
              {runMatching.isPending ? t("pedigree.add.matching") : t("pedigree.add.reviewMatches")}
            </Button>
          </div>
        </section>
      )}

      {/* Step 4 — review / matching */}
      {step === 3 && (
        <section className="mt-6 space-y-4">
          <ReviewSummary
            filledCount={filledAncestors.length}
            decisions={decisions}
            candidatesBySlot={candidatesBySlot}
          />
          {filledAncestors.map((entry) => {
            const cands = candidatesBySlot[entry.slotKey] ?? [];
            const decision = decisions[entry.slotKey];
            return (
              <div key={entry.slotKey} className="rounded-2xl border border-border/70 bg-card p-3">
                <div className="text-sm font-semibold">{entry.registeredName}</div>
                <div className="text-[11px] text-muted-foreground">
                  {t(`pedigree.roleLabel.${entry.role}`)}
                  {entry.pedigreeNumber ? ` · ${entry.pedigreeNumber}` : ""}
                </div>

                {cands.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {cands.map((c) => {
                      const chosen = decision?.action === "use_existing" && decision.dogId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setDecisions((prev) => ({
                              ...prev,
                              [entry.slotKey]: { action: "use_existing", dogId: c.id },
                            }))
                          }
                          className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs ${
                            chosen
                              ? "border-success/50 bg-success/10"
                              : "border-border bg-background"
                          }`}
                        >
                          <span className="truncate">
                            {c.registeredName}
                            {c.pedigreeNumber ? ` · ${c.pedigreeNumber}` : ""}
                          </span>
                          <span className="flex-none text-[10px] uppercase text-muted-foreground">
                            {c.matchedOn.includes("pedigree_number")
                              ? t("pedigree.search.exactMatch")
                              : t("pedigree.add.possibleMatch")}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant={decision?.action === "create_new" ? "default" : "outline"}
                    onClick={() =>
                      setDecisions((prev) => ({
                        ...prev,
                        [entry.slotKey]: { action: "create_new" },
                      }))
                    }
                  >
                    {t("pedigree.add.createNew")}
                  </Button>
                  <Button
                    size="sm"
                    variant={decision?.action === "skip" ? "default" : "outline"}
                    onClick={() =>
                      setDecisions((prev) => ({
                        ...prev,
                        [entry.slotKey]: { action: "skip" },
                      }))
                    }
                  >
                    {t("pedigree.add.skip")}
                  </Button>
                </div>
              </div>
            );
          })}

          {!isSignedIn && (
            <Input
              type="email"
              placeholder={t("pedigree.add.emailPlaceholder")}
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              {t("pedigree.add.back")}
            </Button>
            <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
              {submit.isPending ? t("pedigree.add.submitting") : t("pedigree.add.submit")}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">{t("pedigree.add.reviewFootnote")}</p>
        </section>
      )}
    </div>
  );
}

function ReviewSummary({
  filledCount,
  decisions,
  candidatesBySlot,
}: {
  filledCount: number;
  decisions: Record<string, { action: string; dogId?: string }>;
  candidatesBySlot: Record<string, DogSearchResult[]>;
}) {
  const { t } = useTranslation();
  const useExisting = Object.values(decisions).filter((d) => d.action === "use_existing").length;
  const createNew = Object.values(decisions).filter((d) => d.action === "create_new").length;
  const possible = Object.keys(candidatesBySlot).filter(
    (k) => (candidatesBySlot[k]?.length ?? 0) > 0,
  ).length;
  return (
    <div className="rounded-2xl border border-border/70 bg-secondary/40 p-4 text-sm">
      <p className="font-medium">
        {t("pedigree.add.summaryFound").replace("{n}", String(filledCount))}
      </p>
      <p className="mt-1 text-muted-foreground">
        {t("pedigree.add.summaryBreakdown")
          .replace("{existing}", String(useExisting))
          .replace("{possible}", String(possible))
          .replace("{new}", String(createNew))}
      </p>
    </div>
  );
}
