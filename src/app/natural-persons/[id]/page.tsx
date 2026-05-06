import { notFound } from "next/navigation";
import { getPersonById } from "@/lib/persons/queries";
import { PersonDetailTabs } from "../_components/person-detail-tabs";
import { fromApiPayload } from "../_components/form-schema";

type PageParams = {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ readonly?: string }>;
};

export default async function EditNaturalPersonPage({ params, searchParams }: PageParams) {
  const { id }       = await params;
  const { readonly } = await searchParams;
  const data = await getPersonById(id);
  if (!data || data.person.type !== "NATURAL") {
    notFound();
  }

  const initialValues = fromApiPayload({
    natural: data.natural,
    addresses: data.addresses,
    notes: data.person.notes,
  });

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-3xl px-6 py-4 flex flex-col gap-4">
        <PersonDetailTabs
          personId={data.person.id}
          personCode={data.person.code}
          personName={data.person.displayName}
          initialValues={initialValues}
          readonly={readonly === "true"}
        />
      </main>
    </div>
  );
}
