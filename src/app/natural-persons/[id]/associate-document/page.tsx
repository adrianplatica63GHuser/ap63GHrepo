import { notFound } from "next/navigation";
import { canConfigureRoles } from "@/lib/auth/can-configure-roles";
import { getPersonById } from "@/lib/persons/queries";
import { AssociateDocumentView } from "./associate-document-view";

type PageParams = { params: Promise<{ id: string }> };

export default async function AssociateDocumentPage({ params }: PageParams) {
  const { id } = await params;
  const data = await getPersonById(id);
  if (!data || data.person.type !== "NATURAL") notFound();
  // Slice #34.16 — whether `NoRolesForTypeNote` prints its link. Not a
  // permission check; `can-configure-roles.ts` says why it is asked here and
  // why it degrades to `false` rather than throwing.
  const mayConfigureRoles = await canConfigureRoles();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-4xl px-6 py-4">
        <AssociateDocumentView
          personId={data.person.id}
          personName={data.person.displayName}
          canConfigureRoles={mayConfigureRoles}
          backBase="/natural-persons"
        />
      </main>
    </div>
  );
}
