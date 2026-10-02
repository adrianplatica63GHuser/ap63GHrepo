import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getDocumentById } from "@/lib/documents/queries";
import { AssociatePropertyView } from "./associate-property-view";

type PageParams = { params: Promise<{ id: string }> };

export default async function AssociatePropertyPage({ params }: PageParams) {
  const { id } = await params;
  const record = await getDocumentById(id);
  if (!record) notFound();
  const tUnnamed = await getTranslations("shared.unnamed");
  const label = record.title ?? tUnnamed("document") /* #37.57: never the system ID */;
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="w-full px-6 py-4">
        <AssociatePropertyView
          documentId={record.id}
          documentName={label}
        />
      </main>
    </div>
  );
}
