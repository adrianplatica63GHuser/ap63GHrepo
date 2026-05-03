import { getTranslations } from "next-intl/server";
import { PropertyListView } from "./list-view";

export default async function PropertiesPage() {
  const t = await getTranslations("property");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-5xl px-6 py-8 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("listTitle")}
          </h1>
        </header>

        <PropertyListView />
      </main>
    </div>
  );
}
