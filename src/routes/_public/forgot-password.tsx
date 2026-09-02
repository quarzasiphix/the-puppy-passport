import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PawPrint, Check } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useHydrated } from "@/shared/hooks/use-hydrated";

const schema = z.object({ email: z.string().email("Enter a valid email") });
type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute("/_public/forgot-password")({
  head: () => ({ meta: [{ title: "Reset your password — Havenpaw" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const hydrated = useHydrated();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  async function onSubmit(values: FormValues) {
    const supabase = getSupabaseBrowserClient();
    // Always show the same confirmation regardless of whether the email exists, so this can't be
    // used to probe which addresses have an account.
    await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSent(true);
  }

  return (
    <div className="container-page grid min-h-[80vh] items-center py-16">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-border/70 bg-card p-8 shadow-sm">
        <div className="flex items-center gap-2 text-primary">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <PawPrint className="size-5" />
          </span>
          <span className="font-display text-xl font-semibold">Havenpaw</span>
        </div>

        {sent ? (
          <div className="mt-6 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-success/15 text-success">
              <Check className="size-6" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-medium">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              If an account exists for that address, we've sent a link to reset your password.
            </p>
            <Button asChild className="mt-6" variant="outline">
              <Link to="/signin">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <>
            <h1 className="mt-6 font-display text-3xl font-medium">Reset your password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your email and we'll send you a link to choose a new password.
            </p>
            <Form {...form}>
              <form method="post" onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
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
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={!hydrated || form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            </Form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link to="/signin" className="text-primary hover:underline">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
