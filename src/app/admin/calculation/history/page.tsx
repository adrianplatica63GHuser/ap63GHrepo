import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-arrow";
import { CalculationHistoryList } from "./_components/calculation-history-list";

export default async function CalculationHistoryPage() {
  const t = await getTranslations("calculationHistory");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="flex w-full flex-col gap-6 px-6 py-8">
        <header className="flex items-center gap-3">
          <BackLink href="/admin/calculation" label={t("backToCalculation")} />
          <span className="text-fade dark:text-zinc-600">|</span>
          <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
        </header>

        <CalculationHistoryList />
      </main>
    </div>
  );
}
