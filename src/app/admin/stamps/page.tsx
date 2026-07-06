import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-arrow";
import { StampsListView } from "./_components/stamps-list-view";

export default async function StampsPage() {
  const t = await getTranslations("stamp");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-4xl px-6 py-8 flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <BackLink href="/admin/value-lists">
            {t("backToValueLists")}
          </BackLink>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("pageTitle")}
          </h1>
        </header>

        {/* Info panel — what is a Stamp and when to use it */}
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-900 dark:bg-amber-950/40">
          <h2 className="mb-3 text-base font-semibold text-amber-900 dark:text-amber-200">
            {t("infoPanel.title")}
          </h2>
          <div className="flex flex-col gap-2 text-sm text-amber-800 dark:text-amber-300">
            <p>{t("infoPanel.body1")}</p>
            <p>{t("infoPanel.body2")}</p>
            <p>{t("infoPanel.body3")}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t("infoPanel.codeNote")}
            </p>
            <p className="mt-1 border-t border-amber-200 pt-2 text-xs italic text-amber-600 dark:border-amber-800 dark:text-amber-400">
              {t("infoPanel.seeAlso")}
            </p>
          </div>
        </section>

        <StampsListView />
      </main>
    </div>
  );
}
