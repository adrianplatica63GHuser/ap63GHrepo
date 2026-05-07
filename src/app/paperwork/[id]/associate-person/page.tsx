import { notFound } from "next/navigation";
import { getPaperworkById } from "@/lib/paperwork/queries";
import { AssociatePersonView } from "./associate-person-view";

type PageParams = { params: Promise<{ id: string }> };

export default async function AssociatePersonPage({ params }: PageParams) {
  const { id } = await params;
  const record = await getPaperworkById(id);
  if (!record) notFound();
  const label = record.title ?? record.code;
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-4xl px-6 py-4">
        <AssociatePersonView
          paperworkId={record.id}
          paperworkName={label}
        />
      </main>
    </div>
  );
}
