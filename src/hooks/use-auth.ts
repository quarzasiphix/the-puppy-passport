import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export type AuthState = {
  userId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  roles: { role: string; status: string }[];
};

async function fetchAuthState(): Promise<AuthState> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { userId: null, email: null, firstName: null, lastName: null, roles: [] };
  }

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role, status").eq("user_id", user.id),
  ]);

  return {
    userId: user.id,
    email: user.email ?? null,
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    roles: roles ?? [],
  };
}

// Client-side auth state, kept in sync with Supabase's own auth events (sign in/out/token
// refresh in another tab, etc.) so the header and dashboards update immediately without a full
// navigation. Route guards still rely on the server-verified session from beforeLoad — this hook
// is for UI reactivity, not access control.
export function useAuth() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["auth-state"], queryFn: fetchAuthState, staleTime: 30_000 });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: ["auth-state"] });
    });
    return () => subscription.subscription.unsubscribe();
  }, [queryClient]);

  return {
    ...(query.data ?? { userId: null, email: null, firstName: null, lastName: null, roles: [] }),
    isLoading: query.isLoading,
    isSignedIn: !!query.data?.userId,
  };
}
