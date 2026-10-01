import { getTranslations } from "next-intl/server";
import { HistoryLink } from "./_components/history-link";
import { CalculationView } from "./_components/calculation-view";

export default async function CalculationPage() {
  const t  = await getTranslations("calculation");
  const th = await getTranslations("calculationHistory");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="flex w-full flex-col gap-6 px-6 py-8">
        <header className="flex items-center gap-2">
          {/*
            Slice #21.10.help.rollout: the hand-placed <HelpButton> that used
            to sit here was removed. Screen help is now auto-mounted in the
            breadcrumb bar for every route, so a per-page button would render
            a second, duplicate "?" on this screen alone.
          */}
          <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
          {/* Beside the heading (Slice #37.22), not at the window's far edge. */}
          <div className="ml-4">
            {/* #37.46 (A087): History, icon-only. */}
            <HistoryLink href="/admin/calculation/history" label={th("linkFromCalculation")} />
          </div>
        </header>

        <CalculationView />
      </main>
    </div>
  );
}
