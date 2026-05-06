import { getTranslations } from "next-intl/server";
import { JudicialPersonForm } from "../_components/judicial-person-form";

export default async function NewJudicialPersonPage() {
  const t = await getTranslations("judicialPerson");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-3xl px-6 py-4 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("createTitle")}
          </h1>
        </header>

        <JudicialPersonForm mode="create" />
      </main>
    </div>
  );
}
