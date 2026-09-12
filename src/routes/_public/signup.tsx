import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { usePostHog } from "posthog-js/react";
import { Mail, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { signUp } from "@/domains/identity";
import { Logo } from "@/app/components/logo";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { useTranslation } from "@/shared/i18n";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().optional(),
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

function SignUp() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const posthog = usePostHog();
  const [step, setStep] = useState<0 | 1>(0);
  // Passwordless (Google + magic link) is the primary path; the password field and its extra
  // "just a few more details" step are opt-in. `sentTo` flips the card to the "check your inbox"
  // state after a magic link is sent.
  const [showPassword, setShowPassword] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const hydrated = useHydrated();
  const { t } = useTranslation();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
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
    const valid = await form.trigger(["email", "firstName", "lastName"]);
    const password = form.getValues("password") ?? "";
    if (password.length < 6) {
      form.setError("password", { message: t("signUp.passwordTooShort") });
      return;
    }
    if (valid) setStep(1);
  }

  async function sendMagicLink() {
    const valid = await form.trigger(["email", "firstName", "lastName"]);
    if (!valid) return false;
    const values = form.getValues();
    setSendingLink(true);
    const supabase = getSupabaseBrowserClient();
    // The account and its (single, generic) role are created server-side in auth.callback.tsx
    // when the link is opened. `method: "magic_link"` rides along purely as a PostHog labeling
    // hint for the signup_completed event fired once the user lands on /create-breeder.
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
        data: {
          first_name: values.firstName,
          last_name: values.lastName,
          method: "magic_link",
        },
      },
    });
    setSendingLink(false);
    if (error) {
      // Most likely cause of a bare/unreadable failure here: no SMTP/email provider configured on
      // this Supabase project (see docs/PRODUCTION_SETUP.md §7) — Supabase's Auth API can report
      // that as a 500 with no usable message. Log the raw error for diagnosis either way.
      console.error("signInWithOtp (signup) failed:", error);
      toast.error(
        getFriendlyErrorMessage(error, "Couldn't send the sign-up link. Please try again."),
      );
      return false;
    }
    setSentTo(values.email);
    posthog.capture("signup_magic_link_sent");
    return true;
  }

  async function onSubmit(values: FormValues) {
    const result = await signUp({
      data: {
        email: values.email,
        password: values.password ?? "",
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        city: values.city,
        country: values.country,
      },
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["auth-state"] });
    posthog.capture("signup_completed", { method: "password" });
    toast.success(t("signUp.accountCreatedToast"));
    await navigate({ to: "/create-breeder" });
  }

  async function onGoogleSignUp() {
    const supabase = getSupabaseBrowserClient();
    posthog.capture("signup_google_started");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?method=google`,
      },
    });
    if (error) toast.error(error.message);
  }

  const termsNote = (
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
  );

  return (
    <div className="container-page grid grid-cols-1 min-h-[80vh] items-center py-16">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-border/70 bg-card p-8 shadow-sm">
        <div className="flex items-center gap-2 text-primary">
          <Logo className="size-9" />
          <span className="font-display text-xl font-semibold">Anemalo</span>
        </div>

        {sentTo ? (
          <div className="mt-6 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <Mail className="size-6" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-medium">{t("magicLink.sentTitle")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("magicLink.sentBodyPrefix")}{" "}
              <span className="font-medium text-foreground">{sentTo}</span>.{" "}
              {t("magicLink.sentBodySuffix")}
            </p>
            <div className="mt-6 flex flex-col items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={sendingLink}
                onClick={async () => {
                  if (await sendMagicLink()) toast.success(t("magicLink.resent"));
                }}
              >
                {sendingLink ? t("magicLink.sending") : t("magicLink.resend")}
              </Button>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSentTo(null)}
              >
                {t("magicLink.differentEmail")}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="mt-6 font-display text-3xl font-medium">{t("signUp.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === 0 ? t("signUp.subtitleStep0") : t("signUp.subtitleStep1")}
            </p>

            <Form {...form}>
              <form
                method="post"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (step === 1) form.handleSubmit(onSubmit)();
                  else if (showPassword) goToStepTwo();
                  else sendMagicLink();
                }}
                className="mt-6 space-y-5"
              >
                {step === 0 ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="w-full gap-2 bg-background"
                      onClick={onGoogleSignUp}
                    >
                      <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
                        <path
                          fill="#FFC107"
                          d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                        />
                        <path
                          fill="#FF3D00"
                          d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
                        />
                        <path
                          fill="#4CAF50"
                          d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
                        />
                        <path
                          fill="#1976D2"
                          d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
                        />
                      </svg>
                      {t("authCommon.continueWithGoogle")}
                    </Button>

                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t("authCommon.or")}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("signUp.firstName")}</FormLabel>
                            <FormControl>
                              <Input {...field} />
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

                    {showPassword && (
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
                    )}

                    {termsNote}

                    {showPassword ? (
                      <Button type="submit" className="w-full" size="lg" disabled={!hydrated}>
                        {t("signUp.continue")} <ArrowRight className="ml-1 size-4" />
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        className="w-full gap-2"
                        size="lg"
                        disabled={!hydrated || sendingLink}
                      >
                        <Mail className="size-4" />
                        {sendingLink ? t("magicLink.sending") : t("magicLink.signUpButton")}
                      </Button>
                    )}

                    <button
                      type="button"
                      className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? t("magicLink.useMagicLink") : t("magicLink.usePassword")}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
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
          </>
        )}
      </div>
    </div>
  );
}
