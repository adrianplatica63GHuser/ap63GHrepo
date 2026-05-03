import { getTranslations } from "next-intl/server";
import { PropertyForm } from "../_components/property-form";

export default async function NewPropertyPage() {
  const t = await getTranslations("property");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-4xl px-6 py-8 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("createTitle")}
          </h1>
        </header>

        <PropertyForm mode="create" />
      </main>
    </div>
  );
}
