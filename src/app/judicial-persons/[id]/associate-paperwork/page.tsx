import { notFound } from "next/navigation";
import { getJudicialPersonById } from "@/lib/judicial-persons/queries";
import { AssociatePaperworkView } from "./associate-paperwork-view";

type PageParams = { params: Promise<{ id: string }> };

export default async function AssociatePaperworkPage({ params }: PageParams) {
  const { id } = await params;
  const data = await getJudicialPersonById(id);
  if (!data) notFound();
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-4xl px-6 py-4">
        <AssociatePaperworkView
          personId={data.person.id}
          personName={data.person.displayName}
          backBase="/judicial-persons"
        />
      </main>
    </div>
  );
}
