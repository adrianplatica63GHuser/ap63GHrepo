import { getTranslations } from "next-intl/server";
import { GlobalSearchView } from "./_components/global-search-view";

export default async function GlobalSearchPage() {
  const t = await getTranslations("globalSearch");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("pageSubtitle")}</p>
        </header>

        <GlobalSearchView />
      </main>
    </div>
  );
}
