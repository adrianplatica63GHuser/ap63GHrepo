import { notFound } from "next/navigation";
import { getPersonById, getPersonIdCardLink } from "@/lib/persons/queries";
import { PersonDetailTabs } from "../_components/person-detail-tabs";
import { fromApiPayload } from "../_components/form-schema";

type Tab = "details" | "related" | "properties" | "document" | "metadata";
const VALID_TABS: Tab[] = ["details", "related", "properties", "document", "metadata"];

type PageParams = {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ readonly?: string; tab?: string }>;
};

export default async function EditNaturalPersonPage({ params, searchParams }: PageParams) {
  const { id }             = await params;
  const { readonly, tab }  = await searchParams;
  const data = await getPersonById(id);
  if (!data || data.person.type !== "NATURAL") notFound();

  const initialValues = fromApiPayload({
    natural:   data.natural,
    addresses: data.addresses,
    notes:     data.person.notes,
  });

  const initialTab: Tab =
    tab && VALID_TABS.includes(tab as Tab) ? (tab as Tab) : "details";

  const linkedIdCard = await getPersonIdCardLink(data.person.id);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Slice #21.08.misc: the max-w-3xl (768px) cap was removed so the
          Details tab's two side-by-side panel stacks have room. Matches the
          Property detail page, which is already uncapped. This widens every
          tab on this page, not only Details — intended. */}
      <main className="w-full px-6 py-4 flex flex-col gap-4">
        <PersonDetailTabs
          personId={data.person.id}
          personCode={data.person.code}
          personName={data.person.displayName}
          initialValues={initialValues}
          readonly={readonly === "true"}
          initialTab={initialTab}
          linkedIdCard={linkedIdCard}
        />
      </main>
    </div>
  );
}
