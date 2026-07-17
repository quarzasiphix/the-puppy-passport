import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, HeartHandshake, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { listBreeds } from "@/lib/queries/breeder";
import { submitRehomingRequest } from "@/lib/queries/rehoming";

export const Route = createFileRoute("/_public/rehome")({
  head: () => ({
    meta: [
      { title: "Find a new home for your dog — Havenpaw" },
      {
        name: "description",
        content: "Submit your dog for a moderated private rehoming listing on Havenpaw.",
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
      toast.error(err instanceof Error ? err.message : "Could not submit — please try again."),
  });

  const canPreview = form.name.trim() && form.reasonForRehoming.trim() && form.ownershipDeclaration;
  const breedName = breedsQuery.data?.find((b) => b.id === form.breedId)?.name;

  if (authLoading) return null;

  if (!userId) {
    return (
      <div className="container-page max-w-lg py-24 text-center">
        <HeartHandshake className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 font-display text-3xl font-medium">Find a new home for your dog</h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Sign in to submit your dog for review — this keeps rehoming listings on Havenpaw
          accountable to a real account.
        </p>
        <Button asChild className="mt-4">
          <Link to="/signin">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="container-page max-w-lg py-24 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <h1 className="mt-4 font-display text-3xl font-medium">Submitted for review</h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Thank you — {form.name}'s listing has been submitted. It is{" "}
          <strong>not public yet</strong>. An admin reviews every private rehoming submission before
          it appears on Havenpaw, usually within a couple of days. We'll let you know once it's
          approved.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/adoptions">Browse dogs for adoption</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container-page max-w-2xl py-10">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">Private rehoming</p>
        <h1 className="mt-2 font-display text-3xl font-medium">Find a new home for your dog</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell us about your dog and why you're looking to rehome them. Every submission is reviewed
          by our team before it's shown publicly — this isn't an open classifieds board.
        </p>
      </header>

      {step === "form" && (
        <div className="space-y-4">
          <div>
            <Label>Your dog's name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Sex</Label>
              <Select
                value={form.sex}
                onValueChange={(v) => setForm({ ...form, sex: v as "male" | "female" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Approximate age</Label>
              <Input
                placeholder="e.g. About 3 years"
                value={form.approximateAge}
                onChange={(e) => setForm({ ...form, approximateAge: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Breed (if known)</Label>
              <Select value={form.breedId} onValueChange={(v) => setForm({ ...form, breedId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Mixed / unknown" />
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
              <Label>Color</Label>
              <Input
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Why are you looking to rehome them?</Label>
            <Textarea
              rows={3}
              value={form.reasonForRehoming}
              onChange={(e) => setForm({ ...form, reasonForRehoming: e.target.value })}
              placeholder="This is only seen by our review team, never shown publicly."
            />
          </div>
          <div>
            <Label>Tell adopters about them (optional)</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Personality, habits, what they're like day to day…"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Temperament (optional)</Label>
              <Input
                value={form.temperament}
                onChange={(e) => setForm({ ...form, temperament: e.target.value })}
              />
            </div>
            <div>
              <Label>Ideal home (optional)</Label>
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
              I confirm I am the legal owner of this dog and have the right to rehome them.
            </Label>
          </div>
          <Button className="w-full" disabled={!canPreview} onClick={() => setStep("preview")}>
            Review before submitting
          </Button>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <h2 className="font-display text-lg font-semibold">Review before you submit</h2>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Item label="Name" value={form.name} />
              <Item label="Sex" value={form.sex || "Not set"} />
              <Item label="Breed" value={breedName ?? "Mixed / unknown"} />
              <Item label="Approximate age" value={form.approximateAge || "Not set"} />
              <Item label="Color" value={form.color || "Not set"} />
            </dl>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="font-medium text-foreground">Reason for rehoming</p>
                <p className="text-muted-foreground">{form.reasonForRehoming}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Private — only seen by our review team, never shown publicly.
                </p>
              </div>
              {form.description && (
                <div>
                  <p className="font-medium text-foreground">Public description</p>
                  <p className="text-muted-foreground">{form.description}</p>
                </div>
              )}
            </div>
            <p className="mt-4 rounded-lg bg-warning/10 p-3 text-xs text-foreground">
              This will be submitted for review, not published immediately. An admin checks every
              private rehoming submission before it's visible to anyone else.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("form")} className="flex-1">
              Back and edit
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex-1"
            >
              Submit for review
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
