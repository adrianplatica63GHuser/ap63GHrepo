import { notFound } from "next/navigation";
import { getPersonById } from "@/lib/persons/queries";
import { NaturalPersonForm } from "../_components/natural-person-form";
import { fromApiPayload } from "../_components/form-schema";

type PageParams = { params: Promise<{ id: string }> };

export default async function EditNaturalPersonPage({ params }: PageParams) {
  const { id } = await params;
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
      <main className="mx-auto w-full max-w-3xl px-6 py-8 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {data.person.displayName}
          </h1>
        </header>

        <NaturalPersonForm
          mode="edit"
          personId={data.person.id}
          personCode={data.person.code}
          initialValues={initialValues}
        />
      </main>
    </div>
  );
}
