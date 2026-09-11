import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Logo } from "@/app/components/logo";
import { Button } from "@/shared/ui/button";
import { completeEmailOtp, signupIntentSchema } from "@/domains/identity";
import { useTranslation } from "@/shared/i18n";

// Where an emailed magic-link lands (see supabase/templates/magic_link.html). Deliberately NOT
// under the `_public` layout, and deliberately does NOT verify the token on page load (a loader
// or an effect would run on any plain GET, including an email-security scanner's prefetch) — the
// token is only ever consumed by completeEmailOtp, fired from the button below on a real click.
// See the comment on completeEmailOtp (src/domains/identity/services/actions.ts) for the full
// "email link scanner" incident this defends against.
const searchSchema = z.object({
  token_hash: z.string().optional(),
  type: z.string().optional(),
  intent: signupIntentSchema.optional(),
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth/confirm")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — Anemalo" }] }),
  component: AuthConfirm,
});

function AuthConfirm() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { token_hash: tokenHash, type, intent, next } = Route.useSearch();
  const [state, setState] = useState<"idle" | "working" | "error">(
    tokenHash && type === "magiclink" ? "idle" : "error",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onContinue() {
    if (!tokenHash) return;
    setState("working");
    const result = await completeEmailOtp({ data: { tokenHash, intent } });
    if (result.error) {
      setState("error");
      setErrorMessage(result.error);
      return;
    }
    await navigate({
      to: next && next.startsWith("/") ? next : (result.redirectTo ?? "/dashboard/buyer"),
    });
  }

  return (
    <div className="container-page grid min-h-[80vh] items-center py-16">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-border/70 bg-card p-8 text-center shadow-sm">
        <div className="flex items-center justify-center gap-2 text-primary">
          <Logo className="size-9" />
          <span className="font-display text-xl font-semibold">Anemalo</span>
        </div>

        {state === "error" ? (
          <>
            <h1 className="mt-6 font-display text-2xl font-medium">
              {t("authConfirm.errorTitle")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {errorMessage ?? t("authConfirm.errorBody")}
            </p>
            <Button asChild className="mt-6" variant="outline">
              <a href="/signin">{t("authCommon.backToSignIn")}</a>
            </Button>
          </>
        ) : (
          <>
            <h1 className="mt-6 font-display text-2xl font-medium">{t("authConfirm.title")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("authConfirm.body")}</p>
            <Button
              type="button"
              className="mt-6 w-full"
              size="lg"
              disabled={state === "working"}
              onClick={onContinue}
            >
              {state === "working" ? t("authConfirm.working") : t("authConfirm.submit")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
