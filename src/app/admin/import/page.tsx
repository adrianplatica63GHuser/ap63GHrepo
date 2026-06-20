import { getTranslations } from "next-intl/server";
import { ImportBrowserDynamic as ImportBrowser } from "./_components/import-browser-dynamic";

export default async function AdminImportPage() {
  const t = await getTranslations("adminImport");

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto flex w-full max-w-6xl flex-1 min-h-0 flex-col gap-4 px-6 py-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("pageTitle")}
          </h1>
        </header>

        <ImportBrowser />
      </main>
    </div>
  );
}
