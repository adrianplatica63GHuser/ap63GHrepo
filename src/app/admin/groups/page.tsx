import { getTranslations } from "next-intl/server";
import { GroupsListView } from "./_components/groups-list-view";
import { screenPanel } from "@/lib/ui/field-widths";

// Slice #20.17: BackLink removed — BreadcrumbBar shows "Admin > Grupuri"
// with "Admin" linking to /admin/value-lists.

export default async function GroupsPage() {
  const t = await getTranslations("group");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="w-full px-6 py-8 flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("pageTitle")}
          </h1>
        </header>

        {/* Info panel — what is a Group and when to use it. Slice #37.35: the first tile of the list's unit row (6 units). */}
        <GroupsListView
          about={
            <section {...screenPanel("about-groups", 6)} className="rounded-lg border border-blue-200 bg-blue-50 px-5 py-4 dark:border-blue-900 dark:bg-blue-950/40">
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
          }
        />
      </main>
    </div>
  );
}
