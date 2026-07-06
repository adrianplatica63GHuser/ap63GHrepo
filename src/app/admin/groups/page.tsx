import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-arrow";
import { GroupsListView } from "./_components/groups-list-view";

export default async function GroupsPage() {
  const t = await getTranslations("group");

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

        {/* Info panel — what is a Group and when to use it */}
        <section className="rounded-lg border border-blue-200 bg-blue-50 px-5 py-4 dark:border-blue-900 dark:bg-blue-950/40">
          <h2 className="mb-3 text-base font-semibold text-blue-900 dark:text-blue-200">
            {t("infoPanel.title")}
          </h2>
          <div className="flex flex-col gap-2 text-sm text-blue-800 dark:text-blue-300">
            <p>{t("infoPanel.body1")}</p>
            <p>{t("infoPanel.body2")}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              {t("infoPanel.codeNote")}
            </p>
            <p className="mt-1 border-t border-blue-200 pt-2 text-xs italic text-blue-600 dark:border-blue-800 dark:text-blue-400">
              {t("infoPanel.seeAlso")}
            </p>
          </div>
        </section>

        <GroupsListView />
      </main>
    </div>
  );
}
