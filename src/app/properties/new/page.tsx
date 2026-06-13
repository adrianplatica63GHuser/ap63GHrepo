import { getTranslations } from "next-intl/server";
import { NewPropertyShell } from "../_components/new-property-shell";

export default async function NewPropertyPage() {
  const t = await getTranslations("property");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="w-full px-6 py-4">
        <NewPropertyShell title={t("createTitle")} />
      </main>
    </div>
  );
}
