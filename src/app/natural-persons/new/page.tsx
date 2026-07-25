import { getTranslations } from "next-intl/server";
import { NaturalPersonForm } from "../_components/natural-person-form";

export default async function NewNaturalPersonPage() {
  const t = await getTranslations("naturalPerson");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Slice #21.08.misc: cap removed to match the detail page — the create
          form renders the same two side-by-side panel stacks. */}
      <main className="w-full px-6 py-4 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("createTitle")}
          </h1>
        </header>

        <NaturalPersonForm mode="create" />
      </main>
    </div>
  );
}
