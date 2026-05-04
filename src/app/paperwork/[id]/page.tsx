import { notFound } from "next/navigation";
import { getPaperworkById } from "@/lib/paperwork/queries";
import { PaperworkDetailTabs } from "../_components/paperwork-detail-tabs";
import { fromApiRecord } from "../_components/form-schema";

type PageParams = { params: Promise<{ id: string }> };

export default async function EditPaperworkPage({ params }: PageParams) {
  const { id } = await params;
  const record = await getPaperworkById(id);
  if (!record) notFound();

  const initialValues = fromApiRecord(record);
  const label = record.title ?? record.code;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-4xl px-6 py-4 flex flex-col gap-4">
        <PaperworkDetailTabs
          paperworkId={record.id}
          paperworkCode={record.code}
          paperworkName={label}
          initialValues={initialValues}
        />
      </main>
    </div>
  );
}
