import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { PostHogProvider, usePostHog } from "posthog-js/react";

import appCss from "../styles.css?url";
import { reportLovableError } from "@/app/lovable-error-reporting";
import { getCurrentUser, type CurrentUser, useAuth } from "@/domains/identity";
import { Toaster } from "@/shared/ui/sonner";
import { I18nProvider } from "@/shared/i18n";

// Site-wide default social-share image — the real, hosted brand logo (see Logo component), not a
// bundled asset, so this and the actual logo stay in sync if it's ever updated on the media CDN.
const OG_IMAGE = "https://media.anemalo.com/logo.png";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async (): Promise<{ auth: CurrentUser | null }> => {
    const auth = await getCurrentUser();
    return { auth };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Anemalo — Professional animal transport across Europe" },
      {
        name: "description",
        content:
          "Request individual, express, VIP or shared transport for a dog. We verify the required information, plan the journey and handle transport from pickup to handover. Also home to verified breeders, foundations and adoption listings.",
      },
      { property: "og:title", content: "Anemalo — Professional animal transport across Europe" },
      {
        property: "og:description",
        content:
          "Request animal transport across Poland and Europe, or find a dog from a verified breeder or foundation.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Anemalo" },
      // Site-wide fallback so a shared link never renders as a bare text card. The real brand
      // logo, not a stock/AI photo — the previous hero photo used here looked bad blown up as a
      // social-share thumbnail, same complaint as the homepage hero it also used to be. Per-page
      // overrides (puppy/kennel photos) replace this further down the meta array where a page has
      // one; see puppies.$id.tsx / @{$handle}.tsx.
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function PostHogRoot({ children }: { children: ReactNode }) {
  if (typeof window === "undefined") return children;

  const apiKey = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const apiHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

  if (!apiKey || !apiHost) {
    if (import.meta.env.DEV) {
      const variableName = !apiKey
        ? "VITE_PUBLIC_POSTHOG_PROJECT_TOKEN"
        : "VITE_PUBLIC_POSTHOG_HOST";
      throw new Error(
        `${variableName} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variableName} is configured`,
      );
    }

    return children;
  }

  return (
    <PostHogProvider
      apiKey={apiKey}
      options={{
        api_host: apiHost,
        defaults: "2025-05-24",
        capture_exceptions: true,
        debug: import.meta.env.DEV,
      }}
    >
      <PostHogIdentity />
      {children}
    </PostHogProvider>
  );
}

function PostHogIdentity() {
  const posthog = usePostHog();
  const { userId, email, firstName, lastName, roles, isLoading } = useAuth();
  const identifiedUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (isLoading) return;

    if (!userId) {
      // Do not reset an initially anonymous visitor: preserve their anonymous activity until a
      // real sign-out occurs. Reset only after this browser was previously identified.
      if (identifiedUserId.current) posthog.reset();
      identifiedUserId.current = null;
      return;
    }

    if (identifiedUserId.current === userId) return;

    // A direct account switch must not merge activity between two authenticated people.
    if (identifiedUserId.current) posthog.reset();

    posthog.identify(userId, {
      email: email ?? undefined,
      name: [firstName, lastName].filter(Boolean).join(" ") || undefined,
      roles: roles.map(({ role }) => role),
    });
    identifiedUserId.current = userId;
  }, [email, firstName, isLoading, lastName, posthog, roles, userId]);

  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <PostHogRoot>
        <I18nProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <Toaster position="top-center" richColors />
        </I18nProvider>
      </PostHogRoot>
    </QueryClientProvider>
  );
}
