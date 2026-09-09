import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "@/shared/i18n";

export const Route = createFileRoute("/_public/foundations")({
  head: () => ({ meta: [{ title: "Foundations and rescues — Anemalo" }] }),
  component: FoundationsPlaceholder,
});

function FoundationsPlaceholder() {
  const { t } = useTranslation();
  return (
    <div className="container-page py-24 text-center">
      <ShieldCheck className="mx-auto size-10 text-primary" />
      <h1 className="mt-4 font-display text-3xl font-medium">{t("foundationsPage.title")}</h1>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground">{t("foundationsPage.desc")}</p>
    </div>
  );
}
