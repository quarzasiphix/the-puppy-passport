import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { usePostHog } from "posthog-js/react";
import { Logo } from "@/app/components/logo";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { completePasswordReset } from "@/domains/identity";
import { useTranslation } from "@/shared/i18n";

const schema = z
  .object({
    password: z.string().min(6, "At least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
type FormValues = z.infer<typeof schema>;

// The reset-password link from the email (supabase/templates/recovery.html) carries a raw
// token_hash, not Supabase's auto-consuming {{ .ConfirmationURL }} — see the comment on
// completePasswordReset (src/domains/identity/services/actions.ts) for why. Nothing is verified
// on page load; the token is only ever consumed inside completePasswordReset, fired by this
// form's own submit, so an email-security scanner prefetching this URL can't burn the link.
const searchSchema = z.object({ token_hash: z.string().optional() });

export const Route = createFileRoute("/_public/reset-password")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Choose a new password — Anemalo" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { token_hash: tokenHash } = Route.useSearch();
  const { t } = useTranslation();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: FormValues) {
    if (!tokenHash) return;
    const result = await completePasswordReset({
      data: { tokenHash, password: values.password },
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    posthog.capture("password_reset_completed");
    toast.success(t("resetPassword.updatedToast"));
    await navigate({ to: "/dashboard/buyer" });
  }

  return (
    <div className="container-page grid grid-cols-1 min-h-[80vh] items-center py-16">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-border/70 bg-card p-8 shadow-sm">
        <div className="flex items-center gap-2 text-primary">
          <Logo className="size-9" />
          <span className="font-display text-xl font-semibold">Anemalo</span>
        </div>
        <h1 className="mt-6 font-display text-3xl font-medium">{t("resetPassword.title")}</h1>

        {!tokenHash ? (
          <>
            <p className="mt-4 text-sm text-muted-foreground">{t("resetPassword.invalidLink")}</p>
            <Button asChild className="mt-6" variant="outline">
              <Link to="/forgot-password">{t("resetPassword.requestNewLink")}</Link>
            </Button>
          </>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("resetPassword.newPassword")}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("resetPassword.confirmPassword")}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting
                  ? t("resetPassword.submitting")
                  : t("resetPassword.submit")}
              </Button>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
