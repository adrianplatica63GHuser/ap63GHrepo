import { notFound } from "next/navigation";
import { getDocumentWithSurveyor } from "@/lib/documents/queries";
import { DocumentDetailTabs } from "../_components/document-detail-tabs";
import { fromApiRecord } from "../_components/form-schema";

type Tab = "details" | "related" | "persons" | "properties" | "metadata";
const VALID_TABS: Tab[] = ["details", "related", "persons", "properties", "metadata"];

type PageParams = {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ readonly?: string; tab?: string }>;
};

export default async function EditDocumentPage({ params, searchParams }: PageParams) {
  const { id }             = await params;
  const { readonly, tab }  = await searchParams;
  const record  = await getDocumentWithSurveyor(id);
  if (!record) notFound();

  const initialValues = fromApiRecord(record);
  const label = record.title ?? record.code;
  const initialTab: Tab =
    tab && VALID_TABS.includes(tab as Tab) ? (tab as Tab) : "details";

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="w-full px-6 py-4 flex flex-col gap-4">
        <DocumentDetailTabs
          documentId={record.id}
          documentCode={record.code}
          documentName={label}
          initialValues={initialValues}
          readonly={readonly === "true"}
          initialTab={initialTab}
        />
      </main>
    </div>
  );
}
