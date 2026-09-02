import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  profile: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
  roles: { role: string; status: string }[];
};

// Hydrates router context on every navigation (see __root.tsx beforeLoad) so dashboard layout
// routes can guard themselves without a flash of protected content, and so the header can render
// the signed-in state on the very first server-rendered response.
export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUser | null> => {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("user_roles").select("role, status").eq("user_id", user.id),
    ]);

    return {
      id: user.id,
      email: user.email ?? null,
      profile: profile ?? null,
      roles: roles ?? [],
    };
  },
);
