import { useState } from "react";
import { useForm, Controller, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Checkbox } from "@/shared/ui/checkbox";
import { Progress } from "@/shared/ui/progress";
import { Check, ArrowLeft, ArrowRight } from "lucide-react";
import { useAuth } from "@/domains/identity";
import { submitApplication } from "../services/applications";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";

const purposeOptions = [
  "Family companion",
  "Sport (agility, obedience, herding)",
  "Exhibition",
  "Breeding",
  "Other",
] as const;

const schema = z.object({
  phone: z.string().min(3, "Required so the breeder can reach you"),
  buyerCity: z.string().min(1, "Required"),
  buyerCountry: z.string().min(1, "Required"),
  housingType: z.enum(["house", "apartment"]),
  hasGarden: z.boolean(),
  hasChildren: z.boolean(),
  childrenAges: z.string().optional(),
  otherAnimals: z.string().optional(),
  previousExperience: z.string().optional(),
  breedKnowledge: z.string().optional(),
  workingSchedule: z.string().optional(),
  aloneTime: z.string().optional(),
  intendedPurpose: z.string().min(1, "Required"),
  collectionMethod: z.enum(["pickup", "domestic_transport", "international_transport"]),
  preferredCollectionDate: z.string().optional(),
  message: z.string().min(10, "Tell the breeder a little about yourselves (at least a sentence)"),
});
type FormValues = z.infer<typeof schema>;

const steps = [
  "Basic information",
  "Home & family",
  "Experience",
  "Plans for the dog",
  "Collection & transport",
  "Message to breeder",
  "Review & send",
];

const stepFields: (keyof FormValues)[][] = [
  ["phone", "buyerCity", "buyerCountry"],
  ["housingType", "hasGarden", "hasChildren", "childrenAges", "otherAnimals"],
  ["previousExperience", "breedKnowledge", "workingSchedule", "aloneTime"],
  ["intendedPurpose"],
  ["collectionMethod", "preferredCollectionDate"],
  ["message"],
  [],
];

export function ApplyDialog({
  open,
  onOpenChange,
  puppyName,
  animalId,
  litterId,
  organizationId,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  puppyName: string;
  animalId: string;
  litterId: string | null;
  organizationId: string | null;
  onSubmitted?: () => void;
}) {
  const { userId, isSignedIn } = useAuth();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: "",
      buyerCity: "",
      buyerCountry: "",
      housingType: "house",
      hasGarden: false,
      hasChildren: false,
      childrenAges: "",
      otherAnimals: "",
      previousExperience: "",
      breedKnowledge: "",
      workingSchedule: "",
      aloneTime: "",
      intendedPurpose: purposeOptions[0],
      collectionMethod: "pickup",
      preferredCollectionDate: "",
      message: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!userId) throw new Error("Sign in required");
      await submitApplication({
        animalId,
        litterId,
        buyerId: userId,
        organizationId,
        applicationType: "purchase",
        buyerCity: values.buyerCity,
        buyerCountry: values.buyerCountry,
        phone: values.phone,
        housingType: values.housingType,
        hasGarden: values.hasGarden,
        hasChildren: values.hasChildren,
        childrenAges: values.childrenAges || null,
        otherAnimals: values.otherAnimals || null,
        previousExperience: values.previousExperience || null,
        breedKnowledge: values.breedKnowledge || null,
        workingSchedule: values.workingSchedule || null,
        aloneTime: values.aloneTime || null,
        intendedPurpose: values.intendedPurpose,
        collectionMethod: values.collectionMethod,
        transportRequired: values.collectionMethod !== "pickup",
        preferredCollectionDate: values.preferredCollectionDate || null,
        message: values.message,
      });
    },
    onSuccess: () => {
      setDone(true);
      onSubmitted?.();
    },
    onError: (err) => {
      if (err instanceof Error && err.message.includes("duplicate")) {
        toast.error("You've already applied for this puppy.");
        return;
      }
      if (err instanceof Error && err.message === "Sign in required") {
        toast.error(err.message);
        return;
      }
      toast.error(getFriendlyErrorMessage(err, "Could not send — please try again."));
    },
  });

  function reset() {
    setStep(0);
    setDone(false);
    form.reset();
  }

  async function next() {
    const valid = await form.trigger(stepFields[step]);
    if (valid) setStep((s) => Math.min(steps.length - 1, s + 1));
  }

  if (!isSignedIn) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Sign in to apply</DialogTitle>
            <DialogDescription>
              You need a Havenpaw account so the breeder knows who's applying and you can follow the
              outcome in your dashboard.
            </DialogDescription>
          </DialogHeader>
          <Button asChild className="mt-2">
            <Link to="/signin">Sign in</Link>
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {!done ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Apply for {puppyName}</DialogTitle>
              <DialogDescription>
                Step {step + 1} of {steps.length}: {steps[step]}
              </DialogDescription>
            </DialogHeader>
            <Progress value={((step + 1) / steps.length) * 100} className="my-1" />

            <div className="py-2">
              {step === 0 && <Step1 form={form} />}
              {step === 1 && <Step2 form={form} />}
              {step === 2 && <Step3 form={form} />}
              {step === 3 && <Step4 form={form} />}
              {step === 4 && <Step5 form={form} />}
              {step === 5 && <Step6 form={form} />}
              {step === 6 && <Step7 form={form} puppyName={puppyName} />}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
              >
                <ArrowLeft className="mr-1 size-4" /> Back
              </Button>
              {step < steps.length - 1 ? (
                <Button type="button" onClick={next}>
                  Continue <ArrowRight className="ml-1 size-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={form.handleSubmit((v) => mutation.mutate(v))}
                >
                  {mutation.isPending ? "Sending…" : "Send application"}
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="py-6 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-success/15 text-success">
              <Check className="size-7" />
            </div>
            <h3 className="mt-4 font-display text-2xl font-medium">
              Your application for {puppyName} has been sent
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              This is not a reservation — the breeder reviews it and may approve it, ask for more
              information, invite you to a call, or add you to a waiting list. You'll see the
              outcome in "My applications" and get a notification the moment it changes.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button asChild>
                <Link to="/dashboard/buyer/applications">View my applications</Link>
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}
function F({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Step1({ form }: { form: UseFormReturn<FormValues> }) {
  const {
    register,
    formState: { errors },
  } = form;
  return (
    <div className="space-y-4">
      <F label="Phone" error={errors.phone?.message}>
        <Input placeholder="+48 555 123 456" {...register("phone")} />
      </F>
      <Row>
        <F label="City" error={errors.buyerCity?.message}>
          <Input placeholder="Warsaw" {...register("buyerCity")} />
        </F>
        <F label="Country" error={errors.buyerCountry?.message}>
          <Input placeholder="Poland" {...register("buyerCountry")} />
        </F>
      </Row>
    </div>
  );
}

function Step2({ form }: { form: UseFormReturn<FormValues> }) {
  const { control, register } = form;
  return (
    <div className="space-y-4">
      <F label="Home type">
        <Controller
          control={control}
          name="housingType"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="grid grid-cols-2 gap-2"
            >
              <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <RadioGroupItem value="house" /> House
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <RadioGroupItem value="apartment" /> Apartment
              </label>
            </RadioGroup>
          )}
        />
      </F>
      <Controller
        control={control}
        name="hasGarden"
        render={({ field }) => (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={field.value} onCheckedChange={field.onChange} /> Garden or secure
            outdoor space
          </label>
        )}
      />
      <Controller
        control={control}
        name="hasChildren"
        render={({ field }) => (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={field.value} onCheckedChange={field.onChange} /> Children at home
          </label>
        )}
      />
      <Row>
        <F label="Children's ages (if any)">
          <Input placeholder="e.g. 10, 12" {...register("childrenAges")} />
        </F>
        <F label="Other animals at home">
          <Input placeholder="e.g. one cat, senior labrador" {...register("otherAnimals")} />
        </F>
      </Row>
    </div>
  );
}

function Step3({ form }: { form: UseFormReturn<FormValues> }) {
  const { register } = form;
  return (
    <div className="space-y-4">
      <F label="Previous dogs">
        <Textarea
          placeholder="What breeds, for how long?"
          rows={3}
          {...register("previousExperience")}
        />
      </F>
      <F label="Knowledge of the breed">
        <Textarea
          placeholder="What do you already know about this breed?"
          rows={3}
          {...register("breedKnowledge")}
        />
      </F>
      <Row>
        <F label="Working schedule">
          <Input placeholder="e.g. Hybrid, home 3 days/week" {...register("workingSchedule")} />
        </F>
        <F label="Time the dog may be left alone">
          <Input placeholder="e.g. Max 4 hours" {...register("aloneTime")} />
        </F>
      </Row>
    </div>
  );
}

function Step4({ form }: { form: UseFormReturn<FormValues> }) {
  const { control } = form;
  return (
    <Controller
      control={control}
      name="intendedPurpose"
      render={({ field }) => (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">What's this puppy's future with you?</p>
          {purposeOptions.map((p) => (
            <label
              key={p}
              className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"
            >
              <input
                type="radio"
                className="size-4"
                checked={field.value === p}
                onChange={() => field.onChange(p)}
              />
              {p}
            </label>
          ))}
        </div>
      )}
    />
  );
}

function Step5({ form }: { form: UseFormReturn<FormValues> }) {
  const { control, register } = form;
  return (
    <div className="space-y-4">
      <F label="Collection preference">
        <Controller
          control={control}
          name="collectionMethod"
          render={({ field }) => (
            <RadioGroup value={field.value} onValueChange={field.onChange}>
              {(
                [
                  ["pickup", "Collect from breeder"],
                  ["domestic_transport", "Domestic transport"],
                  ["international_transport", "International transport"],
                ] as const
              ).map(([v, l]) => (
                <label
                  key={v}
                  className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"
                >
                  <RadioGroupItem value={v} /> {l}
                </label>
              ))}
            </RadioGroup>
          )}
        />
      </F>
      <F label="Preferred collection date (optional — you can stay flexible)">
        <Input type="date" {...register("preferredCollectionDate")} />
      </F>
    </div>
  );
}

function Step6({ form }: { form: UseFormReturn<FormValues> }) {
  const {
    register,
    formState: { errors },
  } = form;
  return (
    <F label="Message to the breeder" error={errors.message?.message}>
      <Textarea
        rows={6}
        placeholder="Introduce yourselves and tell the breeder what drew you to this puppy…"
        {...register("message")}
      />
    </F>
  );
}

function Step7({ form, puppyName }: { form: UseFormReturn<FormValues>; puppyName: string }) {
  const v = form.watch();
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-secondary/50 p-4 text-sm">
        <div className="mb-2 font-semibold">Summary for {puppyName}</div>
        <ul className="space-y-1 text-muted-foreground">
          <li>
            · Contact: {v.phone} · {v.buyerCity}, {v.buyerCountry}
          </li>
          <li>
            · Household: {v.housingType === "house" ? "House" : "Apartment"}
            {v.hasGarden ? ", garden" : ""}
            {v.hasChildren ? `, children (${v.childrenAges || "ages not given"})` : ""}
          </li>
          <li>· Purpose: {v.intendedPurpose}</li>
          <li>
            · Collection:{" "}
            {v.collectionMethod === "pickup"
              ? "Collect from breeder"
              : v.collectionMethod === "domestic_transport"
                ? "Domestic transport"
                : "International transport"}
            {v.preferredCollectionDate ? ` — from ${v.preferredCollectionDate}` : " — flexible"}
          </li>
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">
        This goes to the breeder, not a purchase or reservation. They decide who they place their
        puppies with — you'll see the outcome in your dashboard.
      </p>
    </div>
  );
}
