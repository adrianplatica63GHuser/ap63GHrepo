import { getTranslations } from "next-intl/server";
import { SettingsView } from "./_components/settings-view";

export default async function SettingsPage() {
  const t = await getTranslations("settings");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-2xl px-6 py-8 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("pageTitle")}
          </h1>
        </header>

        <SettingsView />
      </main>
    </div>
  );
}
