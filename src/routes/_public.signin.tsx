import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { signIn } from "@/lib/auth/actions";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Required"),
});

type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute("/_public/signin")({
  head: () => ({ meta: [{ title: "Sign in — Havenpaw" }] }),
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    const result = await signIn({ data: values });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["auth-state"] });
    await router.invalidate();
    await navigate({ to: "/dashboard/buyer" });
  }

  async function onOAuth(provider: "google" | "facebook") {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard/buyer` },
    });
    if (error) {
      toast.error(
        `${provider === "google" ? "Google" : "Facebook"} sign-in isn't configured on this server yet — see docs/SOCIAL_AUTH_SETUP.md.`,
      );
    }
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
        <h1 className="mt-6 font-display text-3xl font-medium">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to manage transport requests, applications and reservations.
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
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
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Forgot password?
                    </Link>
                  </div>
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
              {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Form>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Local demo accounts use the password <code>password123</code> — see docs/LOCAL_SETUP.md.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => onOAuth("google")}>
            Continue with Google
          </Button>
          <Button variant="outline" onClick={() => onOAuth("facebook")}>
            Continue with Facebook
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/signup" className="text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
