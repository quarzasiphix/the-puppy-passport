import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { completePasswordlessSignIn, signupIntentSchema } from "@/domains/identity";

// Where every passwordless flow redirects back to — Google OAuth and email magic links alike
// (src/routes/_public/signin.tsx and signup.tsx both pass this as `redirectTo`/`emailRedirectTo`).
// No chrome — intentionally NOT under the `_public` layout — this route exists to redirect
// immediately; a flash of the full site header/footer first would be pure noise.
//
// This exact URL (`<site origin>/auth/callback`) must also be on the Supabase project's Auth →
// URL Configuration → Redirect URLs allow-list (Dashboard, production project), or the provider /
// magic-link redirect is rejected before it ever reaches this route.
const searchSchema = z.object({
  code: z.string().optional(),
  next: z.string().optional(),
  // Present only on the OAuth signup path (signup.tsx appends it to redirectTo). Magic links
  // carry the same hint in user_metadata instead, read server-side in completePasswordlessSignIn.
  intent: signupIntentSchema.optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export const Route = createFileRoute("/auth/callback")({
  validateSearch: searchSchema,
  loader: async ({ location }) => {
    const search = searchSchema.parse(location.search);

    if (search.error) {
      throw redirect({
        to: "/signin",
        search: { oauthError: search.error_description ?? search.error },
      });
    }
    if (!search.code) {
      throw redirect({ to: "/signin", search: { oauthError: "Sign-in was cancelled." } });
    }

    const result = await completePasswordlessSignIn({
      data: { code: search.code, intent: search.intent },
    });
    if (result.error) {
      throw redirect({ to: "/signin", search: { oauthError: result.error } });
    }

    throw redirect({
      to:
        search.next && search.next.startsWith("/")
          ? search.next
          : (result.redirectTo ?? "/dashboard/buyer"),
    });
  },
  component: () => (
    <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">
      Signing you in…
    </div>
  ),
});
