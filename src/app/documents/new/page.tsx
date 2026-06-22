import { getTranslations } from "next-intl/server";
import { DocumentForm } from "../_components/document-form";

export default async function NewDocumentPage() {
  const t = await getTranslations("document");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-4xl px-6 py-4 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("createTitle")}
          </h1>
        </header>

        <DocumentForm mode="create" />
      </main>
    </div>
  );
}
