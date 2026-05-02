import { getTranslations } from "next-intl/server";
import { LocaleToggle } from "@/components/locale-toggle";
import { ValueListHub } from "./_components/value-list-hub";

export default async function ValueListsPage() {
  const t = await getTranslations("valueList");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-4xl px-6 py-8 flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <LocaleToggle />
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("pageTitle")}
          </h1>
          <div className="invisible" aria-hidden>
            <LocaleToggle />
          </div>
        </header>

        <ValueListHub />
      </main>
    </div>
  );
}
