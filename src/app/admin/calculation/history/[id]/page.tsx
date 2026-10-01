import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-arrow";
import { CalculationRunDetail } from "./_components/calculation-run-detail";

type Props = { params: Promise<{ id: string }> };

export default async function CalculationRunDetailPage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations("calculationHistory");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="flex w-full flex-col gap-6 px-6 py-8">
        <header className="flex items-center gap-3">
          <BackLink href="/admin/calculation/history" label={t("backToHistory")} />
          <span className="text-fade dark:text-zinc-600">|</span>
          <h1 className="text-2xl font-semibold tracking-tight">{t("detailTitle")}</h1>
        </header>

        <CalculationRunDetail runId={id} />
      </main>
    </div>
  );
}
