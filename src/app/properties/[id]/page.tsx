import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getPropertyById } from "@/lib/properties/queries";
import { PropertyDetailTiles } from "../_components/property-detail-tiles";
import { fromApiPayload } from "../_components/form-schema";

type PageParams = {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ readonly?: string; tab?: string }>;
};

export default async function EditPropertyPage({ params, searchParams }: PageParams) {
  const { id }              = await params;
  const { readonly, tab }   = await searchParams;

  const data = await getPropertyById(id);
  if (!data) notFound();

  const initialValues = fromApiPayload({
    property: data.property,
    address:  data.address,
  });

  const initialCorners = data.corners.map((c) => ({
    lat: c.lat,
    lon: c.lon,
    originalIndex: c.originalIndex,
  }));

  const tUnnamed = await getTranslations("shared.unnamed");

  const label = data.property.nickname ?? tUnnamed("property") /* #37.57: never the system ID */;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="w-full px-6 py-4 flex flex-col gap-4">
        <PropertyDetailTiles
          propertyId={data.property.id}
          propertyCode={data.property.code}
          propertyName={label}
          initialValues={initialValues}
          initialCorners={initialCorners}
          readonly={readonly === "true"}
          // Slice #37.19: a `?tab=` adds its tile for this visit
          // (PROP_TILE_OF_TAB); `details`, or anything unknown, adds nothing.
          initialTab={tab}
        />
      </main>
    </div>
  );
}
