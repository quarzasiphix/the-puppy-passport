import { useEffect } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PawPrint } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { signIn } from "@/domains/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useHydrated } from "@/shared/hooks/use-hydrated";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Required"),
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
  const { oauthError } = Route.useSearch();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // The OAuth round trip always leaves auth.callback.tsx and lands back here on failure — surface
  // whatever it found (provider not enabled, user cancelled, etc.) once, not as loader-blocking UI.
  useEffect(() => {
    if (oauthError) toast.error(oauthError);
  }, [oauthError]);

  async function onSubmit(values: FormValues) {
    const result = await signIn({ data: values });
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
    // exchangeCodeForSession (the part that actually creates the session) happens server-side in
    // auth.callback.tsx, not here — this call only ever starts the redirect to Google.
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
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <PawPrint className="size-5" />
          </span>
          <span className="font-display text-xl font-semibold">Anemalo</span>
        </div>
        <h1 className="mt-6 font-display text-3xl font-medium">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to manage transport requests, applications and reservations.
        </p>

        {/* Google is the fastest path for most people and is the only social provider actually
            configured (see docs/SOCIAL_AUTH_SETUP.md) — it leads, full width, not a small icon
            button competing with a since-removed Facebook option. */}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="mt-6 w-full gap-2 bg-background"
          onClick={onGoogleSignIn}
        >
          <GoogleIcon /> Continue with Google
        </Button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Or with email
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Form {...form}>
          <form method="post" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              variant="secondary"
              className="w-full"
              size="lg"
              disabled={!hydrated || form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Form>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Local demo accounts use the password <code>password123</code> — see docs/LOCAL_SETUP.md.
        </p>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/signup" className="text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
