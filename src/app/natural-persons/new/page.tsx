import { getTranslations } from "next-intl/server";
import { LocaleToggle } from "@/components/locale-toggle";
import { NaturalPersonForm } from "../_components/natural-person-form";

export default async function NewNaturalPersonPage() {
  const t = await getTranslations("naturalPerson");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-3xl px-6 py-8 flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <LocaleToggle />
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("createTitle")}
          </h1>
          <div className="invisible">
            <LocaleToggle />
          </div>
        </header>

        <NaturalPersonForm mode="create" />
      </main>
    </div>
  );
}
