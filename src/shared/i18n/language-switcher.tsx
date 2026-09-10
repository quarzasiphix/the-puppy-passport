import { Languages } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { useTranslation, SUPPORTED_LOCALES, LOCALE_DISPLAY_NAMES } from "./index";

// Shared manual language switcher — was previously defined only inside site-chrome.tsx (public
// header); extracted here so the dashboard shell can use the exact same control instead of a
// second implementation. `variant="icon"` matches the public header's compact icon button;
// `variant="labeled"` is bigger and shows the current language name, for the dashboard sidebar/
// mobile bar where there's room and the "big, friendly" panel style applies.
export function LanguageSwitcher({ variant = "icon" }: { variant?: "icon" | "labeled" }) {
  const { locale, setLocale, t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <Button variant="ghost" size="icon" aria-label={t("language.switchLabel")}>
            <Languages className="size-4" />
          </Button>
        ) : (
          <button
            type="button"
            aria-label={t("language.switchLabel")}
            className="flex items-center gap-2 rounded-xl bg-secondary/70 px-3 py-2 text-sm font-bold hover:bg-secondary"
          >
            <Languages className="size-4" />
            {LOCALE_DISPLAY_NAMES[locale]}
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            onClick={() => setLocale(code)}
            className={code === locale ? "font-semibold" : undefined}
          >
            {LOCALE_DISPLAY_NAMES[code]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
