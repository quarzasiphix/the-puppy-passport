import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type PlatformRole = Database["public"]["Tables"]["user_roles"]["Row"]["role"];

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  // Matches the 5 registration purposes from the product spec. "customer"/"buyer" are
  // unrestricted and activate immediately; "breeder"/"foundation"/"operations" always start
  // pending — see the self-apply RLS policy on user_roles, which enforces the same rule
  // server-side regardless of what this schema allows client-side.
  intent: z.enum(["customer", "buyer", "breeder", "foundation", "operations"]),
});

const roleForIntent: Record<
  z.infer<typeof signUpSchema>["intent"],
  { role: PlatformRole; status: "active" | "pending" }
> = {
  customer: { role: "customer", status: "active" },
  buyer: { role: "buyer", status: "active" },
  breeder: { role: "breeder", status: "pending" },
  foundation: { role: "foundation_member", status: "pending" },
  operations: { role: "operations", status: "pending" },
};

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

    // The signup page's own copy already says "By creating an account, you agree to Havenpaw's
    // Terms and Privacy" -- record it as a real, versioned fact rather than just UI text with
    // nothing behind it. Best-effort: a consent-recording failure must never block account
    // creation itself, which has already succeeded by this point.
    const { data: currentVersions } = await supabase
      .from("legal_document_versions")
      .select("document_type, version")
      .in("document_type", ["terms", "privacy"])
      .eq("is_current", true);
    if (currentVersions?.length) {
      await supabase.from("user_consents").insert(
        currentVersions.map((v) => ({
          profile_id: signUpData.user!.id,
          document_type: v.document_type,
          version: v.version,
        })),
      );
    }

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
