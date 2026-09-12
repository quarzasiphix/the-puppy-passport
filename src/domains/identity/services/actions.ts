import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type PlatformRole = Database["public"]["Tables"]["user_roles"]["Row"]["role"];

// Every brand-new account gets this single, unrestricted, immediately-active role — no upfront
// "what are you here to do" choice. What kind of account this really is (a plain buyer, or the
// owner of a kennel/foundation/shelter/transport company) is decided afterwards, once signed in,
// on the full-screen chooser at /create-breeder — see that route for the org-type path, which
// grants an *additional* role (breeder/foundation_member/shelter_member/transport_company_owner)
// on top of this one via create_own_organisation().
const NEW_ACCOUNT_ROLE: { role: PlatformRole; status: "active" } = {
  role: "buyer",
  status: "active",
};

// OAuth (Google) can't carry `method` in user_metadata (Google owns the profile), so it rides the
// `?method=` query param on the callback URL instead; magic links carry it in user_metadata (set
// via signInWithOtp's options.data). Used only to label the post-signup `signup_completed`
// PostHog event fired from /create-breeder — never affects role/redirect logic.
export const signupMethodSchema = z.enum(["google", "magic_link"]);
export type SignupMethod = z.infer<typeof signupMethodSchema>;

// Records the user's acceptance of the current Terms + Privacy versions as a real, versioned fact
// (every signup UI shows "by continuing you agree to…"). Best-effort: a consent-write failure
// must never block an account that has already been created.
async function recordInitialConsent(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  userId: string,
) {
  const { data: currentVersions } = await supabase
    .from("legal_document_versions")
    .select("document_type, version")
    .in("document_type", ["terms", "privacy"])
    .eq("is_current", true);
  if (currentVersions?.length) {
    await supabase.from("user_consents").insert(
      currentVersions.map((v) => ({
        profile_id: userId,
        document_type: v.document_type,
        version: v.version,
      })),
    );
  }
}

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
});

export const signUp = createServerFn({ method: "POST" })
  .validator(signUpSchema)
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();

    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone ?? null,
          country: data.country ?? null,
          city: data.city ?? null,
        },
      },
    });

    if (error) return { error: error.message };
    if (!signUpData.user) return { error: "Account could not be created." };

    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: signUpData.user.id,
      role: NEW_ACCOUNT_ROLE.role,
      status: NEW_ACCOUNT_ROLE.status,
    });
    if (roleError) return { error: roleError.message };

    await recordInitialConsent(supabase, signUpData.user.id);

    return { error: null };
  });

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const signIn = createServerFn({ method: "POST" })
  .validator(signInSchema)
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    return { error: error?.message ?? null };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const supabase = getSupabaseServerClient();
  await supabase.auth.signOut();
  return { error: null };
});

// Completes a passwordless sign-in. Both OAuth (Google) and email magic links land back on
// src/routes/auth.callback.tsx with a `?code=`, and both finish the same way: the PKCE code
// exchange MUST happen server-side, through this cookie-aware client (see src/lib/supabase/
// server.ts's own comment), or the session lands in the browser client's storage but never in
// the cookies the SSR loaders / getCurrentUser() read — the classic "signed in on the client,
// signed out on every server-rendered page" bug. `supabase.auth.signInWithOAuth()` /
// `signInWithOtp()` on the browser only ever *start* the flow; this is where the session is born.
//
// It also provisions first-time passwordless users. The email/password path creates the
// user_roles row and records consent inside signUp(); a Google or magic-link user would
// otherwise arrive with zero roles (every role-gated RLS policy and the whole role UI then
// misbehaves) — provisioned with the same generic NEW_ACCOUNT_ROLE signUp() uses.
//
// `method` is a pure PostHog labeling hint (see signupMethodSchema above), never role/redirect
// logic — it comes from `data.method` (the `?method=` query param, Google only — Supabase's
// redirect-URL allowlist strips other query params off OAuth callback URLs in production, but the
// literal `redirectTo` URL survives untouched) or `user.user_metadata.method` (magic links, set
// via `signInWithOtp`'s `options.data`).
async function provisionAfterPasswordlessAuth(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  user: { id: string; user_metadata?: Record<string, unknown> | null },
  dataMethod: SignupMethod | undefined,
): Promise<{
  error: string | null;
  redirectTo: "/dashboard/buyer" | "/create-breeder" | null;
  isNewUser: boolean;
  method: SignupMethod | null;
}> {
  const metaMethod = signupMethodSchema.safeParse(user.user_metadata?.method);
  const method: SignupMethod | null = dataMethod ?? (metaMethod.success ? metaMethod.data : null);

  const { data: existingRoles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .limit(1);

  if (existingRoles?.length) {
    // Returning user — nothing to provision.
    return { error: null, redirectTo: "/dashboard/buyer", isNewUser: false, method: null };
  }

  const { error: roleError } = await supabase.from("user_roles").insert({
    user_id: user.id,
    role: NEW_ACCOUNT_ROLE.role,
    status: NEW_ACCOUNT_ROLE.status,
  });
  if (roleError)
    return { error: roleError.message, redirectTo: null, isNewUser: false, method: null };

  await recordInitialConsent(supabase, user.id);

  return { error: null, redirectTo: "/create-breeder", isNewUser: true, method };
}

const completePasswordlessSignInSchema = z.object({
  code: z.string().min(1),
  method: signupMethodSchema.optional(),
});

export const completePasswordlessSignIn = createServerFn({ method: "GET" })
  .validator(completePasswordlessSignInSchema)
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();

    const { error } = await supabase.auth.exchangeCodeForSession(data.code);
    if (error) return { error: error.message, redirectTo: null, isNewUser: false, method: null };

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return {
        error: "Sign-in could not be completed.",
        redirectTo: null,
        isNewUser: false,
        method: null,
      };

    return provisionAfterPasswordlessAuth(supabase, user, data.method);
  });

// Completes a magic-link sign-in from src/routes/auth.confirm.tsx. Deliberately a POST, fired
// only when the user clicks the "Continue" button on that page — never auto-run on GET/page
// load. See docs/REGISTRATION_FLOW_AUDIT.md "email link scanner" incident: Supabase's default
// magic-link/recovery templates link straight to GoTrue's own GET /verify, which some corporate
// mail scanners silently prefetch, consuming the one-time token before the real user ever
// clicks — every subsequent real click then fails with "Email link is invalid or has expired".
// Routing the email link to our own page first, and only calling verifyOtp on an explicit
// button click, means a GET-only prefetcher never triggers verification at all.
const completeEmailOtpSchema = z.object({
  tokenHash: z.string().min(1),
});

export const completeEmailOtp = createServerFn({ method: "POST" })
  .validator(completeEmailOtpSchema)
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();

    const { error } = await supabase.auth.verifyOtp({
      token_hash: data.tokenHash,
      type: "magiclink",
    });
    if (error) return { error: error.message, redirectTo: null, isNewUser: false, method: null };

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return {
        error: "Sign-in could not be completed.",
        redirectTo: null,
        isNewUser: false,
        method: null,
      };

    // Magic-link method always comes from user_metadata (set by sendMagicLink in signup.tsx),
    // never a request param.
    return provisionAfterPasswordlessAuth(supabase, user, undefined);
  });

// Completes a password reset from src/routes/_public/reset-password.tsx. Verification and the
// actual password change happen together, in one POST, fired only when the user submits the
// "choose a new password" form — never on page load. Same rationale as completeEmailOtp above:
// the recovery email link now carries a raw token_hash (not Supabase's auto-consuming
// ConfirmationURL), so nothing is consumed until the user genuinely submits a new password.
const completePasswordResetSchema = z.object({
  tokenHash: z.string().min(1),
  password: z.string().min(6),
});

export const completePasswordReset = createServerFn({ method: "POST" })
  .validator(completePasswordResetSchema)
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: data.tokenHash,
      type: "recovery",
    });
    if (verifyError) return { error: verifyError.message };

    const { error: updateError } = await supabase.auth.updateUser({ password: data.password });
    if (updateError) return { error: updateError.message };

    return { error: null };
  });
