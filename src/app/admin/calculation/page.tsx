import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { CalculationView } from "./_components/calculation-view";

export default async function CalculationPage() {
  const t  = await getTranslations("calculation");
  const th = await getTranslations("calculationHistory");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <header className="flex items-center gap-2">
          {/*
            Slice #21.10.help.rollout: the hand-placed <HelpButton> that used
            to sit here was removed. Screen help is now auto-mounted in the
            breadcrumb bar for every route, so a per-page button would render
            a second, duplicate "?" on this screen alone.
          */}
          <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
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
