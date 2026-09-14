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
      // The real Anemalo paw+pin mark (see Logo component), replacing the Lovable-starter
      // default favicon (an orange/pink/blue gradient heart, nothing to do with this brand) that
      // was still sitting in public/favicon.ico untouched since the project's Lovable scaffold.
      // PNG favicons alongside the .ico so modern browsers render a crisp icon at their native
      // tab/pinned-tile size instead of the browser's own downscale of one arbitrary size.
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", href: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
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
        // Explicit, not just relying on the versioned `defaults` bundle's current behavior — forms
        // across the app collect real PII (names, phone numbers, addresses). maskAllInputs mirrors
        // the SDK default already, but pinning it here means a future posthog-js/library default
        // change can't silently start recording raw input values. Password fields are always
        // masked by the SDK regardless of this setting.
        session_recording: {
          maskAllInputs: true,
        },
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

// A page open in a tab that's outlived a deploy will still be running the OLD index.html/root
// bundle, which references route chunks by their old content-hashed filename. The moment a new
// deploy replaces those files, any further client-side navigation (or lazy route load) in that
// stale tab 404s trying to fetch a chunk that no longer exists — surfaces as "Failed to fetch
// dynamically imported module" and can crash out through React's lazy-loading machinery (React
// error #520) before ever reaching errorComponent above, since it's a module-loading failure, not
// a component render error. The fix is always the same regardless of which exact error shape hits:
// a fresh page load fetches the current, self-consistent index.html + chunks. Guarded by
// sessionStorage so a *genuinely* broken deploy (a chunk 404ing even right after a fresh load)
// reloads once, not in an infinite loop — after that it falls through to whatever error UI would
// otherwise have shown.
const CHUNK_RELOAD_GUARD_KEY = "anemalo:chunk-reload-guard";
const CHUNK_LOAD_ERROR_PATTERN =
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i;

function reloadOnceForStaleChunk() {
  if (typeof window === "undefined") return;
  if (window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)) return;
  window.sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, "1");
  window.location.reload();
}

function useChunkReloadGuard() {
  useEffect(() => {
    // Reaching this effect at all proves the current page booted successfully — clear any guard
    // flag left over from a prior reload so a *later*, unrelated deploy in this same tab session
    // can still trigger a fresh auto-reload instead of being silently suppressed forever.
    window.sessionStorage.removeItem(CHUNK_RELOAD_GUARD_KEY);

    // Vite's own signal for a failed modulepreload/dynamic import — the most direct hook when it
    // fires, but browsers/Vite versions vary in when exactly they raise it.
    const onVitePreloadError = (event: Event) => {
      event.preventDefault();
      reloadOnceForStaleChunk();
    };
    // Fallback: the raw promise rejection from a dynamic import(), for cases vite:preloadError
    // doesn't cover (e.g. TanStack Router's own lazy route loading).
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
      if (CHUNK_LOAD_ERROR_PATTERN.test(message)) reloadOnceForStaleChunk();
    };

    window.addEventListener("vite:preloadError", onVitePreloadError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("vite:preloadError", onVitePreloadError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useChunkReloadGuard();

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
