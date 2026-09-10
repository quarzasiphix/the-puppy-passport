import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Logo } from "@/app/components/logo";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { signIn } from "@/domains/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { useTranslation } from "@/shared/i18n";
import { getFriendlyErrorMessage } from "@/shared/lib/errors";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const searchSchema = z.object({ oauthError: z.string().optional() });

export const Route = createFileRoute("/_public/signin")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — Anemalo" }] }),
  component: SignIn,
});

// Google-branded "G" mark, inline (no icon library ships this — lucide-react is intentionally
// brand-neutral) — real, current Google sign-in button colors, not a generic lock/user icon.
function GoogleIcon() {
  return (
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
  );
}

function SignIn() {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const hydrated = useHydrated();
  const { t } = useTranslation();
  const { oauthError } = Route.useSearch();

  // Passwordless (Google + magic link) is the primary path; the password field is opt-in so the
  // common case stays a single tap. `sentTo` flips the card to the "check your inbox" state.
  const [showPassword, setShowPassword] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // The OAuth round trip always leaves auth.callback.tsx and lands back here on failure — surface
  // whatever it found (provider not enabled, user cancelled, etc.) once, not as loader-blocking UI.
  useEffect(() => {
    if (oauthError) toast.error(oauthError);
  }, [oauthError]);

  async function sendMagicLink(email: string) {
    setSendingLink(true);
    const supabase = getSupabaseBrowserClient();
    // exchangeCodeForSession (the part that actually creates the session) happens server-side in
    // auth.callback.tsx — this only ever sends the email. shouldCreateUser:false so a typo can't
    // silently create an account; a missing account still shows the same confirmation below
    // (anti-enumeration, mirrors forgot-password.tsx).
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false,
      },
    });
    setSendingLink(false);
    if (error) {
      // "user not found" / "signups not allowed" are the expected shape of shouldCreateUser:false
      // rejecting an unknown address — show the same success confirmation for those (anti-
      // enumeration, mirrors forgot-password.tsx) instead of an error. Anything else is a genuine
      // failure (most likely: no SMTP/email provider configured on this Supabase project — see
      // docs/PRODUCTION_SETUP.md §7 — which Supabase's Auth API can report as a bare 500 with no
      // usable message). Log the raw error for diagnosis; never show a blank/unreadable toast.
      if (!/signups?\s+not\s+allowed|otp_disabled|user\s+not\s+found/i.test(error.message ?? "")) {
        console.error("signInWithOtp failed:", error);
        toast.error(
          getFriendlyErrorMessage(error, "Couldn't send the sign-in link. Please try again."),
        );
        return false;
      }
    }
    setSentTo(email);
    return true;
  }

  async function onMagicLink() {
    const ok = await form.trigger("email");
    if (ok) await sendMagicLink(form.getValues("email"));
  }

  async function onPasswordSubmit(values: FormValues) {
    if (!values.password) {
      form.setError("password", { message: t("authCommon.passwordRequired") });
      return;
    }
    const result = await signIn({ data: { email: values.email, password: values.password } });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["auth-state"] });
    await router.invalidate();
    await navigate({ to: "/dashboard/buyer" });
  }

  async function onGoogleSignIn() {
    const supabase = getSupabaseBrowserClient();
    // This call only ever starts the redirect to Google; the code exchange is server-side.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className="container-page grid min-h-[80vh] items-center py-16">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-border/70 bg-card p-8 shadow-sm">
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
                  const ok = await sendMagicLink(sentTo);
                  if (ok) toast.success(t("magicLink.resent"));
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
            <h1 className="mt-6 font-display text-3xl font-medium">{t("signIn.welcomeBack")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("signIn.subtitle")}</p>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="mt-6 w-full gap-2 bg-background"
              onClick={onGoogleSignIn}
            >
              <GoogleIcon /> {t("authCommon.continueWithGoogle")}
            </Button>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("authCommon.or")}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Form {...form}>
              <form
                method="post"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (showPassword) form.handleSubmit(onPasswordSubmit)();
                  else onMagicLink();
                }}
                className="space-y-4"
              >
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
                        <div className="flex items-center justify-between">
                          <FormLabel>{t("authCommon.password")}</FormLabel>
                          <Link
                            to="/forgot-password"
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            {t("signIn.forgotPassword")}
                          </Link>
                        </div>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {showPassword ? (
                  <Button
                    type="submit"
                    variant="secondary"
                    className="w-full"
                    size="lg"
                    disabled={!hydrated || form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting ? t("signIn.submitting") : t("signIn.submit")}
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="w-full gap-2"
                    size="lg"
                    disabled={!hydrated || sendingLink}
                  >
                    <Mail className="size-4" />
                    {sendingLink ? t("magicLink.sending") : t("magicLink.signInButton")}
                  </Button>
                )}
              </form>
            </Form>

            <button
              type="button"
              className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? t("magicLink.useMagicLink") : t("magicLink.usePassword")}
            </button>

            <div className="mt-6 border-t border-border/60 pt-5 text-center">
              <p className="text-sm text-muted-foreground">{t("signIn.newHere")}</p>
              <Button asChild variant="outline" size="lg" className="mt-3 w-full">
                <Link to="/signup">{t("signIn.createAccount")}</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
