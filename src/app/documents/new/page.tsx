import { getTranslations } from "next-intl/server";
import { DocumentForm } from "../_components/document-form";
import { canConfigureRoles } from "@/lib/auth/can-configure-roles";

export default async function NewDocumentPage() {
  const t = await getTranslations("document");
  // Slice #37.85: only a superuser is told a type has no form, and where to build one.
  const isSuperuser = await canConfigureRoles();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="w-full px-6 py-4 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("createTitle")}
          </h1>
        </header>

        <DocumentForm mode="create" isSuperuser={isSuperuser} />
      </main>
    </div>
  );
}
