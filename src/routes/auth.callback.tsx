import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { exchangeOAuthCode } from "@/domains/identity";

// Where every OAuth provider (currently just Google — see docs/SOCIAL_AUTH_SETUP.md) is configured
// to redirect back to (src/routes/_public/signin.tsx passes this as `redirectTo`). No chrome —
// intentionally NOT under the `_public` layout — this route exists to redirect immediately, a
// flash of the full site header/footer before that happens would be pure noise.
//
// This must also be added to the Supabase project's Auth → URL Configuration → Redirect URLs
// allow-list (Dashboard, production project) as `<site origin>/auth/callback`, or the provider
// redirect itself will be rejected before ever reaching this route.
const searchSchema = z.object({
  code: z.string().optional(),
  next: z.string().optional(),
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

    const result = await exchangeOAuthCode({ data: { code: search.code } });
    if (result.error) {
      throw redirect({ to: "/signin", search: { oauthError: result.error } });
    }

    throw redirect({ to: search.next && search.next.startsWith("/") ? search.next : "/dashboard/buyer" });
  },
  component: () => (
    <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">
      Signing you in…
    </div>
  ),
});
