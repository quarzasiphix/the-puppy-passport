import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  PawPrint,
  Truck,
  Dog,
  HeartHandshake,
  Search,
  Headset,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { signUp } from "@/domains/identity";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { useTranslation } from "@/shared/i18n";

const schema = z.object({
  intent: z.enum(["customer", "buyer", "breeder", "foundation", "operations"]),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  phone: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute("/_public/signup")({
  head: () => ({ meta: [{ title: "Create an account — Anemalo" }] }),
  component: SignUp,
});

// "What do you primarily want to do?" — matches the 5 registration purposes from the product
// spec. Only "breeder"/"foundation"/"operations" ever create a *pending* (gated) role; the other
// two are unrestricted and active immediately.
const intents = [
  {
    value: "customer" as const,
    labelKey: "signUp.intentCustomerLabel",
    icon: Truck,
    descKey: "signUp.intentCustomerDesc",
  },
  {
    value: "buyer" as const,
    labelKey: "signUp.intentBuyerLabel",
    icon: Search,
    descKey: "signUp.intentBuyerDesc",
  },
  {
    value: "breeder" as const,
    labelKey: "signUp.intentBreederLabel",
    icon: Dog,
    descKey: "signUp.intentBreederDesc",
  },
  {
    value: "foundation" as const,
    labelKey: "signUp.intentFoundationLabel",
    icon: HeartHandshake,
    descKey: "signUp.intentFoundationDesc",
  },
  {
    value: "operations" as const,
    labelKey: "signUp.intentOperationsLabel",
    icon: Headset,
    descKey: "signUp.intentOperationsDesc",
  },
];

function SignUp() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<0 | 1>(0);
  const hydrated = useHydrated();
  const { t } = useTranslation();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      intent: "customer",
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      phone: "",
      city: "",
      country: "",
    },
  });

  async function goToStepTwo() {
    const valid = await form.trigger(["intent", "email", "password"]);
    if (valid) setStep(1);
  }

  async function onSubmit(values: FormValues) {
    const result = await signUp({ data: values });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["auth-state"] });
    toast.success(t("signUp.accountCreatedToast"));
    if (values.intent === "breeder" || values.intent === "foundation") {
      await navigate({ to: "/create-breeder" });
    } else if (values.intent === "operations") {
      toast.info(t("signUp.operationsPendingToast"));
      await navigate({ to: "/dashboard/buyer" });
    } else {
      await navigate({ to: "/dashboard/buyer" });
    }
  }

  return (
    <div className="container-page grid min-h-[80vh] items-center py-16">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-border/70 bg-card p-8 shadow-sm">
        <div className="flex items-center gap-2 text-primary">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <PawPrint className="size-5" />
          </span>
          <span className="font-display text-xl font-semibold">Anemalo</span>
        </div>
        <h1 className="mt-6 font-display text-3xl font-medium">{t("signUp.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === 0 ? t("signUp.subtitleStep0") : t("signUp.subtitleStep1")}
        </p>

        <Form {...form}>
          <form
            method="post"
            onSubmit={(e) => {
              e.preventDefault();
              if (step === 0) goToStepTwo();
              else form.handleSubmit(onSubmit)();
            }}
            className="mt-6 space-y-5"
          >
            {step === 0 ? (
              <>
                <FormField
                  control={form.control}
                  name="intent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {t("signUp.iAmHereTo")}
                      </FormLabel>
                      <div className="grid gap-2">
                        {intents.map((opt) => (
                          <button
                            type="button"
                            key={opt.value}
                            onClick={() => field.onChange(opt.value)}
                            className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                              field.value === opt.value
                                ? "border-primary bg-primary/5"
                                : "border-border bg-background hover:bg-secondary/50"
                            }`}
                          >
                            <opt.icon className="mt-0.5 size-4 shrink-0 text-primary" />
                            <span>
                              <span className="block text-sm font-medium">
                                {t(opt.labelKey)}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {t(opt.descKey)}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("authCommon.email")}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("authCommon.password")}</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" size="lg" disabled={!hydrated}>
                  {t("signUp.continue")} <ArrowRight className="ml-1 size-4" />
                </Button>
              </>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("signUp.firstName")}</FormLabel>
                        <FormControl>
                          <Input {...field} autoFocus />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("signUp.lastName")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("signUp.cityOptional")}</FormLabel>
                        <FormControl>
                          <Input placeholder="Warsaw" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("signUp.countryOptional")}</FormLabel>
                        <FormControl>
                          <Input placeholder="Poland" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("signUp.phoneOptional")}</FormLabel>
                      <FormControl>
                        <Input placeholder="+48 555 123 456" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <p className="text-xs text-muted-foreground">{t("signUp.prefsNote")}</p>

                <p className="text-xs text-muted-foreground">
                  {t("signUp.termsPrefix")}{" "}
                  <Link to="/terms" className="text-primary hover:underline">
                    {t("signUp.termsOfService")}
                  </Link>{" "}
                  {t("signUp.and")}{" "}
                  <Link to="/privacy" className="text-primary hover:underline">
                    {t("signUp.privacyPolicy")}
                  </Link>
                  .
                </p>

                <div className="flex items-center justify-between">
                  <Button type="button" variant="ghost" onClick={() => setStep(0)}>
                    <ArrowLeft className="mr-1 size-4" /> {t("signUp.back")}
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={!hydrated || form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting ? t("signUp.submitting") : t("signUp.submit")}
                  </Button>
                </div>
              </>
            )}
          </form>
        </Form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("signUp.alreadyHaveAccount")}{" "}
          <Link to="/signin" className="text-primary hover:underline">
            {t("signUp.signInLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
