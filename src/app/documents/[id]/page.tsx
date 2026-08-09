import { notFound } from "next/navigation";
import {
  getDocumentTypeTemplate,
  getDocumentWithSurveyor,
} from "@/lib/documents/queries";
import { documentStatus } from "@/lib/documents/status";
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

  // ── Slice #26.12: New / AI processed / Imported, derived, never stored ─────
  //
  // The brief asks for the status "near the top" of the document page, so it is
  // decided on the server beside the record it describes rather than guessed in
  // a component. Both halves come from facts the row already carries — the
  // import's `ai_interpreted_at` stamp, and whether this document's type has a
  // custom form — so there is nothing to keep in sync and nothing to migrate.
  //
  // `getDocumentTypeTemplate` is reused rather than a new one-column read: it
  // is the same function the AI-extraction route asks "does this type have a
  // form?", and two readers of one question should not be two queries that
  // could answer it differently. It returns PARSED fields, which is what
  // `documentTypeHasForm` re-parses — cheap, and it means the badge and the
  // form the user sees are counting the same fields.
  //
  // The page re-renders after every save (`router.refresh()` in
  // document-form.tsx), so changing a document's type updates the badge without
  // a reload.
  const typeTemplate = await getDocumentTypeTemplate(record.documentTypeId);
  const status = documentStatus({
    aiInterpretedAt:    record.aiInterpretedAt,
    typeTemplateFields: typeTemplate?.fields ?? null,
  });
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
          aiInterpretedAt={record.aiInterpretedAt ? record.aiInterpretedAt.toISOString() : null}
          status={status}
          readonly={readonly === "true"}
          initialTab={initialTab}
        />
      </main>
    </div>
  );
}
