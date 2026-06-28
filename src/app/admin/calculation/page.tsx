import { getTranslations } from "next-intl/server";
import { HelpButton } from "@/components/help/help-button";
import { CalculationView } from "./_components/calculation-view";

export default async function CalculationPage() {
  const t = await getTranslations("calculation");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <header className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
          <HelpButton screenKey="admin-calculation" />
        </header>

        <CalculationView />
      </main>
    </div>
  );
}
