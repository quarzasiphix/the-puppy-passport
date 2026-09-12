import { Construction } from "lucide-react";
import { useTranslation } from "@/shared/i18n";

// Reused by every dashboard destination that has a nav entry but no real functionality yet —
// "do not create blank white pages" / "consistent 'not implemented in this phase' placeholders
// with the intended purpose, not fake functionality."
export function NotImplemented({ title, purpose }: { title: string; purpose: string }) {
  const { t } = useTranslation();
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium">{title}</h1>
      </header>
      <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-10 text-center">
        <Construction className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">{t("dashboardShell.notImplemented")}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{purpose}</p>
      </div>
    </div>
  );
}
