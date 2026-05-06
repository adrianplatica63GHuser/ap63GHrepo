import { notFound } from "next/navigation";
import { getPropertyById } from "@/lib/properties/queries";
import { AssociatePaperworkView } from "./associate-paperwork-view";

type PageParams = { params: Promise<{ id: string }> };

export default async function AssociatePaperworkPage({ params }: PageParams) {
  const { id } = await params;
  const data = await getPropertyById(id);
  if (!data) notFound();
  const label = data.property.nickname ?? data.property.code;
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-4xl px-6 py-4">
        <AssociatePaperworkView propertyId={data.property.id} propertyName={label} />
      </main>
    </div>
  );
}
