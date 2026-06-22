import { notFound } from "next/navigation";
import { getJudicialPersonById } from "@/lib/judicial-persons/queries";
import { JudicialPersonDetailTabs } from "../_components/person-detail-tabs";
import { fromApiPayload } from "../_components/form-schema";

type Tab = "details" | "references" | "properties" | "document";
const VALID_TABS: Tab[] = ["details", "references", "properties", "document"];

type PageParams = {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ readonly?: string; tab?: string }>;
};

export default async function EditJudicialPersonPage({ params, searchParams }: PageParams) {
  const { id }             = await params;
  const { readonly, tab }  = await searchParams;
  const data = await getJudicialPersonById(id);
  if (!data) notFound();

  const initialValues = fromApiPayload({
    judicial:           data.judicial,
    addresses:          data.addresses,
    notes:              data.person.notes,
    contactPerson1Name: data.contactPerson1Name,
    contactPerson2Name: data.contactPerson2Name,
  });

  const initialTab: Tab =
    tab && VALID_TABS.includes(tab as Tab) ? (tab as Tab) : "details";

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-3xl px-6 py-4 flex flex-col gap-4">
        <JudicialPersonDetailTabs
          personId={data.person.id}
          personCode={data.person.code}
          personName={data.person.displayName}
          initialValues={initialValues}
          readonly={readonly === "true"}
          initialTab={initialTab}
        />
      </main>
    </div>
  );
}
