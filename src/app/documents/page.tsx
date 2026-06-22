import { getTranslations } from "next-intl/server";
import { DocumentListView } from "./list-view";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DocumentsPage({ searchParams }: PageProps) {
  const t = await getTranslations("document");
  const params = await searchParams;

  // ?documentTypeIds= param drives the "Document type:" dropdown filter
  // on the list page itself (Slice #15.08 — moved out of the sidebar).
  //   absent  → undefined → show all
  //   ""      → []        → 0 types selected → show "please select" message
  //   "uuid,uuid" → [...] → show only those types
  const idsParam =
    typeof params.documentTypeIds === "string" ? params.documentTypeIds : undefined;

  const initialDocumentTypeIds: string[] | undefined =
    idsParam === undefined
      ? undefined
      : idsParam === ""
      ? []
      : idsParam.split(",").filter(Boolean);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-5xl px-6 py-8 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("listTitle")}
          </h1>
        </header>

        <DocumentListView initialDocumentTypeIds={initialDocumentTypeIds} />
      </main>
    </div>
  );
}
