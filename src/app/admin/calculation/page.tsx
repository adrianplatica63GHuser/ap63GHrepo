import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { HelpButton } from "@/components/help/help-button";
import { CalculationView } from "./_components/calculation-view";

export default async function CalculationPage() {
  const t  = await getTranslations("calculation");
  const th = await getTranslations("calculationHistory");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <header className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
          <HelpButton screenKey="admin-calculation" />
          <div className="ml-auto">
            <Link
              href="/admin/calculation/history"
              className="inline-flex items-center rounded-md border border-wire bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              {th("linkFromCalculation")}
            </Link>
          </div>
        </header>

        <CalculationView />
      </main>
    </div>
  );
}
