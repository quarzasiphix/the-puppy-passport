import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Languages } from "lucide-react";
import { useTranslation, type Locale } from "./index";
import { getSuggestedLocale } from "./geo";
import { useHydrated } from "@/shared/hooks/use-hydrated";

const DISMISS_KEY = "anemalo-locale-banner-dismissed";

// The banner's own copy is deliberately NOT run through the main t() dictionary — it has to be
// legible to a visitor who is currently seeing the *other* language, so both the "you might want
// this language" message and the switch button need to read in the SUGGESTED locale regardless of
// what's currently active. Extend this map when a third locale is added.
const SUGGESTION_COPY: Record<Locale, { message: string; switchCta: string; dismiss: string }> = {
  pl: {
    message: "Wygląda na to, że jesteś w Polsce — przełączyć stronę na polski?",
    switchCta: "Przełącz na polski",
    dismiss: "Zamknij",
  },
  en: {
    message: "Looks like you're browsing from elsewhere — switch this page to English?",
    switchCta: "Switch to English",
    dismiss: "Dismiss",
  },
};

// Suggest, never force — an automatic geo/IP redirect is the pattern Google explicitly advises
// against (breaks crawling of the non-redirected version, annoys VPN/expat visitors). This reads
// a server-detected suggestion (Cloudflare's `cf-ipcountry` header, falling back to
// Accept-Language — see geo.ts) and offers a one-click switch; the visitor's choice is what
// actually changes the active locale, this component never does it on its own.
export function LocaleSuggestionBanner() {
  const { locale, setLocale } = useTranslation();
  const hydrated = useHydrated();
  const [dismissed, setDismissed] = useState(true); // true until proven otherwise, avoids an SSR flash

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const suggestedQuery = useQuery({
    queryKey: ["suggested-locale"],
    queryFn: () => getSuggestedLocale(),
    enabled: hydrated,
    staleTime: Infinity, // a visitor's country doesn't change mid-session; no reason to re-ask
  });

  const suggested = suggestedQuery.data;
  if (!hydrated || dismissed || !suggested || suggested === locale) return null;

  const copy = SUGGESTION_COPY[suggested];

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="border-b border-primary/20 bg-primary/5">
      <div className="container-page flex items-center justify-between gap-3 py-2.5 text-sm">
        <span className="flex items-center gap-2 text-foreground">
          <Languages className="size-4 shrink-0 text-primary" />
          {copy.message}
        </span>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setLocale(suggested);
              dismiss();
            }}
            className="font-medium text-primary hover:underline"
          >
            {copy.switchCta}
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label={copy.dismiss}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
