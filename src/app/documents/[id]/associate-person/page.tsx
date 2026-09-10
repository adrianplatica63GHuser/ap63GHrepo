import { notFound } from "next/navigation";
import { canConfigureRoles } from "@/lib/auth/can-configure-roles";
import { getDocumentById } from "@/lib/documents/queries";
import { AssociatePersonView } from "./associate-person-view";

type PageParams = { params: Promise<{ id: string }> };

export default async function AssociatePersonPage({ params }: PageParams) {
  const { id } = await params;
  const record = await getDocumentById(id);
  if (!record) notFound();
  const label = record.title ?? record.code;

  /**
   * Whether this reader can open „Roluri pe Document" — Slice #34.16.
   *
   * Decides whether `NoRolesForTypeNote` prints its link, and nothing else;
   * `can-configure-roles.ts` carries the argument for asking on the server, for
   * spelling it the way `app/admin/layout.tsx` spells it, and for degrading to
   * `false` rather than throwing over a decoration.
   */
  const mayConfigureRoles = await canConfigureRoles();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-4xl px-6 py-4">
        <AssociatePersonView
          documentId={record.id}
          documentName={label}
          canConfigureRoles={mayConfigureRoles}
        />
      </main>
    </div>
  );
}
