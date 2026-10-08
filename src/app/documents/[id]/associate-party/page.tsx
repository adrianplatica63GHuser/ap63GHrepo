import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { canConfigureRoles } from "@/lib/auth/can-configure-roles";
import { getDocumentById } from "@/lib/documents/queries";
import { AssociatePartyView } from "./associate-party-view";

type PageParams = { params: Promise<{ id: string }> };

export default async function AssociatePartyPage({ params }: PageParams) {
  const { id } = await params;
  const record = await getDocumentById(id);
  if (!record) notFound();
  const tUnnamed = await getTranslations("shared.unnamed");
  const label = record.title ?? tUnnamed("document") /* #37.57: never the system ID */;
  // Slice #38.38: the party's role comes from the type's list, as on „Asociază persoană".
  const mayConfigureRoles = await canConfigureRoles();
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="w-full px-6 py-4">
        <AssociatePartyView
          documentId={record.id}
          documentName={label}
          canConfigureRoles={mayConfigureRoles}
        />
      </main>
    </div>
  );
}
