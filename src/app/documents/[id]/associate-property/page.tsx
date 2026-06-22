import { notFound } from "next/navigation";
import { getDocumentById } from "@/lib/documents/queries";
import { AssociatePropertyView } from "./associate-property-view";

type PageParams = { params: Promise<{ id: string }> };

export default async function AssociatePropertyPage({ params }: PageParams) {
  const { id } = await params;
  const record = await getDocumentById(id);
  if (!record) notFound();
  const label = record.title ?? record.code;
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-4xl px-6 py-4">
        <AssociatePropertyView
          documentId={record.id}
          documentName={label}
        />
      </main>
    </div>
  );
}
