import { notFound } from "next/navigation";
import { getJudicialPersonById } from "@/lib/judicial-persons/queries";
import { JudicialPersonDetailTiles } from "../_components/person-detail-tiles";
import { fromApiPayload } from "../_components/form-schema";

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

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Slice #37.13: the centred 768-pixel cap (max-w-3xl mx-auto) is gone —
          the four panels have fixed widths of their own and sit left-aligned
          beside the sidebar, as the Natural Person's do (#37.12). */}
      <main className="w-full px-6 py-4 flex flex-col gap-4">
        <JudicialPersonDetailTiles
          personId={data.person.id}
          personCode={data.person.code}
          personName={data.person.displayName}
          initialValues={initialValues}
          readonly={readonly === "true"}
          // Slice #37.18: a `?tab=` adds its tile for this visit
          // (JP_TILE_OF_TAB); `details`, or anything unknown, adds nothing.
          initialTab={tab}
        />
      </main>
    </div>
  );
}
