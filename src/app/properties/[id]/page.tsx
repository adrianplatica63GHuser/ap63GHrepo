import { notFound } from "next/navigation";
import { getPropertyById } from "@/lib/properties/queries";
import { PropertyDetailTabs } from "../_components/property-detail-tabs";
import { fromApiPayload } from "../_components/form-schema";

type Tab = "details" | "references" | "persons" | "paperwork";
const VALID_TABS: Tab[] = ["details", "references", "persons", "paperwork"];

type PageParams = {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function EditPropertyPage({ params, searchParams }: PageParams) {
  const { id }  = await params;
  const { tab } = await searchParams;

  const data = await getPropertyById(id);
  if (!data) notFound();

  const initialValues = fromApiPayload({
    property: data.property,
    address:  data.address,
  });

  const initialCorners = data.corners.map((c) => ({
    lat: c.lat,
    lon: c.lon,
  }));

  const label = data.property.nickname ?? data.property.code;

  // Only accept known tab names; fall back to "details" for anything else.
  const initialTab: Tab =
    tab && VALID_TABS.includes(tab as Tab) ? (tab as Tab) : "details";

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-4xl px-6 py-4 flex flex-col gap-4">
        <PropertyDetailTabs
          propertyId={data.property.id}
          propertyCode={data.property.code}
          propertyName={label}
          initialValues={initialValues}
          initialCorners={initialCorners}
          initialTab={initialTab}
        />
      </main>
    </div>
  );
}
