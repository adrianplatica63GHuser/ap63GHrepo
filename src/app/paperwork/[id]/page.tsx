import { notFound } from "next/navigation";
import { getPaperworkById } from "@/lib/paperwork/queries";
import { PaperworkDetailTabs } from "../_components/paperwork-detail-tabs";
import { fromApiRecord } from "../_components/form-schema";

type Tab = "details" | "references" | "persons" | "properties";
const VALID_TABS: Tab[] = ["details", "references", "persons", "properties"];

type PageParams = {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ readonly?: string; tab?: string }>;
};

export default async function EditPaperworkPage({ params, searchParams }: PageParams) {
  const { id }             = await params;
  const { readonly, tab }  = await searchParams;
  const record  = await getPaperworkById(id);
  if (!record) notFound();

  const initialValues = fromApiRecord(record);
  const label = record.title ?? record.code;
  const initialTab: Tab =
    tab && VALID_TABS.includes(tab as Tab) ? (tab as Tab) : "details";

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-4xl px-6 py-4 flex flex-col gap-4">
        <PaperworkDetailTabs
          paperworkId={record.id}
          paperworkCode={record.code}
          paperworkName={label}
          initialValues={initialValues}
          readonly={readonly === "true"}
          initialTab={initialTab}
        />
      </main>
    </div>
  );
}
