import { getTranslations } from "next-intl/server";
import { LocaleToggle } from "@/components/locale-toggle";
import { PropertyListView } from "./list-view";

export default async function PropertiesPage() {
  const t = await getTranslations("property");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-5xl px-6 py-8 flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <LocaleToggle />
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("listTitle")}
          </h1>
          {/* Spacer to balance the LocaleToggle on the left */}
          <div className="invisible">
            <LocaleToggle />
          </div>
        </header>

        <PropertyListView />
      </main>
    </div>
  );
}
