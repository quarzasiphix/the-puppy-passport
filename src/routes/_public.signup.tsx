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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { signUp } from "@/lib/auth/actions";
import { useHydrated } from "@/hooks/use-hydrated";

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
  head: () => ({ meta: [{ title: "Create an account — Havenpaw" }] }),
  component: SignUp,
});

// "What do you primarily want to do?" — matches the 5 registration purposes from the product
// spec. Only "breeder"/"foundation"/"operations" ever create a *pending* (gated) role; the other
// two are unrestricted and active immediately.
const intents = [
  {
    value: "customer" as const,
    label: "Request animal transport",
    icon: Truck,
    desc: "Submit and track transport requests.",
  },
  {
    value: "buyer" as const,
    label: "Find a dog",
    icon: Search,
    desc: "Browse breeders and foundations, save and apply for animals.",
  },
  {
    value: "breeder" as const,
    label: "Publish as a breeder",
    icon: Dog,
    desc: "Requires verification before you can publish.",
  },
  {
    value: "foundation" as const,
    label: "Represent a foundation or rescue",
    icon: HeartHandshake,
    desc: "Requires verification before you can publish.",
  },
  {
    value: "operations" as const,
    label: "Manage transport operations",
    icon: Headset,
    desc: "Requires approval from a Havenpaw administrator.",
  },
];

function SignUp() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<0 | 1>(0);
  const hydrated = useHydrated();
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
    toast.success("Account created — welcome to Havenpaw.");
    if (values.intent === "breeder" || values.intent === "foundation") {
      await navigate({ to: "/create-breeder" });
    } else if (values.intent === "operations") {
      toast.info("Your operations access request is pending administrator approval.");
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
          <span className="font-display text-xl font-semibold">Havenpaw</span>
        </div>
        <h1 className="mt-6 font-display text-3xl font-medium">Create an account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === 0
            ? "Start with what you're here to do — you can request transport, browse breeders, or apply for verification at any time afterwards."
            : "Almost done — just a name so breeders and our team know who they're talking to."}
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
                        I am here to…
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
                              <span className="block text-sm font-medium">{opt.label}</span>
                              <span className="block text-xs text-muted-foreground">
                                {opt.desc}
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
                      <FormLabel>Email</FormLabel>
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
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" size="lg" disabled={!hydrated}>
                  Continue <ArrowRight className="ml-1 size-4" />
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
                        <FormLabel>First name</FormLabel>
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
                        <FormLabel>Last name</FormLabel>
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
                        <FormLabel>City (optional)</FormLabel>
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
                        <FormLabel>Country (optional)</FormLabel>
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
                      <FormLabel>Phone (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="+48 555 123 456" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <p className="text-xs text-muted-foreground">
                  Preferred language and currency, and anything breed/kennel-specific, can be set
                  afterwards from your account page — no need to fill everything in now.
                </p>

                <p className="text-xs text-muted-foreground">
                  By creating an account, you agree to Havenpaw's{" "}
                  <Link to="/terms" className="text-primary hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </p>

                <div className="flex items-center justify-between">
                  <Button type="button" variant="ghost" onClick={() => setStep(0)}>
                    <ArrowLeft className="mr-1 size-4" /> Back
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={!hydrated || form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting ? "Creating account…" : "Create account"}
                  </Button>
                </div>
              </>
            )}
          </form>
        </Form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/signin" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
