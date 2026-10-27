import { notFound } from "next/navigation";
import { getPersonById } from "@/lib/persons/queries";
import { listPersonIdentityDocuments } from "@/lib/identity-documents/queries";
import { PersonDetailTiles } from "../_components/person-detail-tiles";
import { fromApiPayload } from "../_components/form-schema";

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

  // Slice 40.85: „Acte de identitate" — every identity document the person holds, of any kind.
  const identityDocuments = await listPersonIdentityDocuments(data.person.id);

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      {/* Slice #21.08.misc: the max-w-3xl (768px) cap was removed so the
          Details tab's two side-by-side panel stacks have room. Matches the
          Property detail page, which is already uncapped. This widens every
          tab on this page, not only Details — intended. */}
      <main className="w-full px-6 py-4 flex flex-col gap-4">
        <PersonDetailTiles
          personId={data.person.id}
          personCode={data.person.code}
          personName={data.person.displayName}
          initialValues={initialValues}
          initialRelationshipIds={data.relationshipIds ?? []}
          readonly={readonly === "true"}
          // Slice #37.17: a `?tab=` adds its tile for this visit
          // (NP_TILE_OF_TAB); `details`, or anything unknown, adds nothing.
          initialTab={tab}
          identityDocuments={identityDocuments}
        />
      </main>
    </div>
  );
}
