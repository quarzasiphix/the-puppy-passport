import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookies } from "@tanstack/react-start/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type PlatformRole = Database["public"]["Tables"]["user_roles"]["Row"]["role"];

// The 5 registration purposes from the product spec, shared by every entry point that can create
// an account: the email/password form, the magic-link form, and the OAuth callback. "customer"/
// "buyer" are unrestricted and activate immediately; "breeder"/"foundation"/"operations" always
// start pending — the user_roles self-apply RLS policy enforces the same rule server-side no
// matter what a client sends here.
export const SIGNUP_INTENTS = ["customer", "buyer", "breeder", "foundation", "operations"] as const;
export const signupIntentSchema = z.enum(SIGNUP_INTENTS);
export type SignupIntent = (typeof SIGNUP_INTENTS)[number];

const roleForIntent: Record<SignupIntent, { role: PlatformRole; status: "active" | "pending" }> = {
  customer: { role: "customer", status: "active" },
  buyer: { role: "buyer", status: "active" },
  breeder: { role: "breeder", status: "pending" },
  foundation: { role: "foundation_member", status: "pending" },
  operations: { role: "operations", status: "pending" },
};

// Single source of truth for where a *newly registered* user lands, keyed off their chosen
// intent: breeders and foundations go straight into kennel/organisation setup, everyone else to
// the buyer dashboard (the app's shared signed-in home). Returning users always go to the shared
// home regardless of intent.
export function landingPathForIntent(intent: SignupIntent): "/create-breeder" | "/dashboard/buyer" {
  return intent === "breeder" || intent === "foundation" ? "/create-breeder" : "/dashboard/buyer";
}

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
  intent: signupIntentSchema,
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

    const roleToInsert = roleForIntent[data.intent];
    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: signUpData.user.id,
      role: roleToInsert.role,
      status: roleToInsert.status,
    });
    if (roleError) return { error: roleError.message };

    await recordInitialConsent(supabase, signUpData.user.id);

    return { error: null, intent: data.intent };
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
// misbehaves). `intent` stays constrained by the user_roles self-apply RLS policy, so no
// privileged role can be granted here regardless of source.
//
// Where `intent` comes from, in priority order:
//   1. `data.intent` — the `?intent=` query param on the callback URL. Works for magic links
//      (Supabase's own redirect, no third-party hop) but is UNRELIABLE for Google: Supabase's
//      redirect-URL allowlist validation strips extra query params from OAuth `redirectTo` URLs
//      in production (documented Supabase limitation — the Google -> GoTrue -> app round trip
//      does not reliably preserve them). Confirmed live 2026-09-11: a breeder-intent Google
//      sign-up was silently provisioned as a plain "customer".
//   2. `ANEMALO_SIGNUP_INTENT_COOKIE` — a short-lived first-party cookie set by
//      `signup.tsx`'s `onGoogleSignUp` right before starting the Google redirect. Cookies DO
//      survive that round trip (SameSite=Lax rides along on the top-level navigation back to our
//      own origin) — this is the reliable channel for Google specifically. Read once, then
//      deleted, win or lose.
//   3. `user.user_metadata.intent` — magic links only (set via `signInWithOtp`'s `options.data`).
//   4. "customer" — safe default, matches the RLS policy's unrestricted-role set.
export const ANEMALO_SIGNUP_INTENT_COOKIE = "anemalo_signup_intent";

// Shared by every passwordless entry point (OAuth code exchange, magic-link token verification)
// once a session/user has been established. Provisions first-time passwordless users the same
// way signUp() does for the password path — a Google or magic-link user would otherwise arrive
// with zero roles.
async function provisionAfterPasswordlessAuth(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  user: { id: string; user_metadata?: Record<string, unknown> | null },
  dataIntent: SignupIntent | undefined,
): Promise<{ error: string | null; redirectTo: "/dashboard/buyer" | "/create-breeder" | null }> {
  const cookieIntent = signupIntentSchema.safeParse(getCookies()[ANEMALO_SIGNUP_INTENT_COOKIE]);
  deleteCookie(ANEMALO_SIGNUP_INTENT_COOKIE);
  const metaIntent = signupIntentSchema.safeParse(user.user_metadata?.intent);
  const intent: SignupIntent =
    dataIntent ??
    (cookieIntent.success ? cookieIntent.data : undefined) ??
    (metaIntent.success ? metaIntent.data : "customer");

  const { data: existingRoles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .limit(1);

  if (existingRoles?.length) {
    // Returning user — nothing to provision, and their intent hint is stale by now.
    return { error: null, redirectTo: "/dashboard/buyer" };
  }

  const roleToInsert = roleForIntent[intent];
  const { error: roleError } = await supabase.from("user_roles").insert({
    user_id: user.id,
    role: roleToInsert.role,
    status: roleToInsert.status,
  });
  if (roleError) return { error: roleError.message, redirectTo: null };

  await recordInitialConsent(supabase, user.id);

  return { error: null, redirectTo: landingPathForIntent(intent) };
}

const completePasswordlessSignInSchema = z.object({
  code: z.string().min(1),
  intent: signupIntentSchema.optional(),
});

export const completePasswordlessSignIn = createServerFn({ method: "GET" })
  .validator(completePasswordlessSignInSchema)
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();

    const { error } = await supabase.auth.exchangeCodeForSession(data.code);
    if (error) return { error: error.message, redirectTo: null };

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Sign-in could not be completed.", redirectTo: null };

    return provisionAfterPasswordlessAuth(supabase, user, data.intent);
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
  intent: signupIntentSchema.optional(),
});

export const completeEmailOtp = createServerFn({ method: "POST" })
  .validator(completeEmailOtpSchema)
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();

    const { error } = await supabase.auth.verifyOtp({
      token_hash: data.tokenHash,
      type: "magiclink",
    });
    if (error) return { error: error.message, redirectTo: null };

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Sign-in could not be completed.", redirectTo: null };

    return provisionAfterPasswordlessAuth(supabase, user, data.intent);
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
