import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, HeartHandshake, ShieldCheck } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { useAuth } from "@/domains/identity";
import { listBreeds } from "@/domains/breeders";
import { submitRehomingRequest } from "@/domains/marketplace";
import { useTranslation } from "@/shared/i18n";

import { getFriendlyErrorMessage } from "@/shared/lib/errors";
export const Route = createFileRoute("/_public/rehome")({
  head: () => ({
    meta: [
      { title: "Find a new home for your dog — Anemalo" },
      {
        name: "description",
        content: "Submit your dog for a moderated private rehoming listing on Anemalo.",
      },
    ],
  }),
  component: RehomePage,
});

type FormState = {
  name: string;
  breedId: string;
  sex: "male" | "female" | "";
  approximateAge: string;
  color: string;
  description: string;
  temperament: string;
  idealHome: string;
  reasonForRehoming: string;
  ownershipDeclaration: boolean;
};

const emptyForm: FormState = {
  name: "",
  breedId: "",
  sex: "",
  approximateAge: "",
  color: "",
  description: "",
  temperament: "",
  idealHome: "",
  reasonForRehoming: "",
  ownershipDeclaration: false,
};

function RehomePage() {
  const { userId, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState<"form" | "preview" | "success">("form");
  const [form, setForm] = useState<FormState>(emptyForm);
  const breedsQuery = useQuery({ queryKey: ["breeds"], queryFn: listBreeds });

  const mutation = useMutation({
    mutationFn: () =>
      submitRehomingRequest({
        ownerUserId: userId!,
        name: form.name,
        breedId: form.breedId || null,
        sex: form.sex || null,
        approximateAge: form.approximateAge || null,
        color: form.color || null,
        description: form.description || null,
        temperament: form.temperament || null,
        idealHome: form.idealHome || null,
        reasonForRehoming: form.reasonForRehoming,
        ownershipDeclaration: form.ownershipDeclaration,
      }),
    onSuccess: () => setStep("success"),
    onError: (err) =>
      toast.error(getFriendlyErrorMessage(err, t("rehomePage.couldNotSubmit"))),
  });

  const canPreview = form.name.trim() && form.reasonForRehoming.trim() && form.ownershipDeclaration;
  const breedName = breedsQuery.data?.find((b) => b.id === form.breedId)?.name;

  if (authLoading) return null;

  if (!userId) {
    return (
      <div className="container-page max-w-lg py-24 text-center">
        <HeartHandshake className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 font-display text-3xl font-medium">{t("rehomePage.title")}</h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          {t("rehomePage.signInSubtitle")}
        </p>
        <Button asChild className="mt-4">
          <Link to="/signin">{t("nav.signIn")}</Link>
        </Button>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="container-page max-w-lg py-24 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <h1 className="mt-4 font-display text-3xl font-medium">{t("rehomePage.successTitle")}</h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          {t("rehomePage.successBodyPrefix")}
          {form.name}
          {t("rehomePage.successBodyMid")}
          <strong>{t("rehomePage.notPublicYet")}</strong>
          {t("rehomePage.successBodySuffix")}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/adoptions">{t("rehomePage.browseAdoptions")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container-page max-w-2xl py-10">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">
          {t("rehomePage.eyebrow")}
        </p>
        <h1 className="mt-2 font-display text-3xl font-medium">{t("rehomePage.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("rehomePage.headerSubtitle")}</p>
      </header>

      {step === "form" && (
        <div className="space-y-4">
          <div>
            <Label>{t("rehomePage.dogName")}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t("rehomePage.sex")}</Label>
              <Select
                value={form.sex}
                onValueChange={(v) => setForm({ ...form, sex: v as "male" | "female" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("rehomePage.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">{t("rehomePage.female")}</SelectItem>
                  <SelectItem value="male">{t("rehomePage.male")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("rehomePage.approximateAge")}</Label>
              <Input
                placeholder={t("rehomePage.approximateAgePlaceholder")}
                value={form.approximateAge}
                onChange={(e) => setForm({ ...form, approximateAge: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t("rehomePage.breedIfKnown")}</Label>
              <Select value={form.breedId} onValueChange={(v) => setForm({ ...form, breedId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("rehomePage.mixedUnknown")} />
                </SelectTrigger>
                <SelectContent>
                  {(breedsQuery.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("rehomePage.color")}</Label>
              <Input
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>{t("rehomePage.reasonLabel")}</Label>
            <Textarea
              rows={3}
              value={form.reasonForRehoming}
              onChange={(e) => setForm({ ...form, reasonForRehoming: e.target.value })}
              placeholder={t("rehomePage.reasonPlaceholder")}
            />
          </div>
          <div>
            <Label>{t("rehomePage.descLabel")}</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t("rehomePage.descPlaceholder")}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t("rehomePage.temperament")}</Label>
              <Input
                value={form.temperament}
                onChange={(e) => setForm({ ...form, temperament: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("rehomePage.idealHome")}</Label>
              <Input
                value={form.idealHome}
                onChange={(e) => setForm({ ...form, idealHome: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-border/70 p-3">
            <Checkbox
              id="ownership"
              checked={form.ownershipDeclaration}
              onCheckedChange={(v) => setForm({ ...form, ownershipDeclaration: v === true })}
            />
            <Label htmlFor="ownership" className="text-sm font-normal leading-snug">
              {t("rehomePage.ownershipDeclaration")}
            </Label>
          </div>
          <Button className="w-full" disabled={!canPreview} onClick={() => setStep("preview")}>
            {t("rehomePage.reviewBeforeSubmitting")}
          </Button>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <h2 className="font-display text-lg font-semibold">{t("rehomePage.reviewHeading")}</h2>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Item label={t("rehomePage.itemName")} value={form.name} />
              <Item
                label={t("rehomePage.sex")}
                value={
                  form.sex
                    ? form.sex === "female"
                      ? t("rehomePage.female")
                      : t("rehomePage.male")
                    : t("rehomePage.notSet")
                }
              />
              <Item label={t("rehomePage.itemBreed")} value={breedName ?? t("rehomePage.mixedUnknown")} />
              <Item
                label={t("rehomePage.approximateAge")}
                value={form.approximateAge || t("rehomePage.notSet")}
              />
              <Item label={t("rehomePage.color")} value={form.color || t("rehomePage.notSet")} />
            </dl>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="font-medium text-foreground">
                  {t("rehomePage.reasonForRehomingLabel")}
                </p>
                <p className="text-muted-foreground">{form.reasonForRehoming}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("rehomePage.privateNote")}</p>
              </div>
              {form.description && (
                <div>
                  <p className="font-medium text-foreground">{t("rehomePage.publicDescription")}</p>
                  <p className="text-muted-foreground">{form.description}</p>
                </div>
              )}
            </div>
            <p className="mt-4 rounded-lg bg-warning/10 p-3 text-xs text-foreground">
              {t("rehomePage.previewWarning")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("form")} className="flex-1">
              {t("rehomePage.backAndEdit")}
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex-1"
            >
              {t("rehomePage.submitForReview")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium capitalize">{value}</dd>
    </div>
  );
}
