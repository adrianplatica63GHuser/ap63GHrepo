import { notFound } from "next/navigation";
import { LocaleToggle } from "@/components/locale-toggle";
import { getPropertyById } from "@/lib/properties/queries";
import { PropertyForm } from "../_components/property-form";
import { fromApiPayload } from "../_components/form-schema";

type PageParams = { params: Promise<{ id: string }> };

export default async function EditPropertyPage({ params }: PageParams) {
  const { id } = await params;
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

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-4xl px-6 py-8 flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <LocaleToggle />
          <h1 className="text-2xl font-semibold tracking-tight">{label}</h1>
          <div className="invisible"><LocaleToggle /></div>
        </header>

        <PropertyForm
          mode="edit"
          propertyId={data.property.id}
          propertyCode={data.property.code}
          initialValues={initialValues}
          initialCorners={initialCorners}
        />
      </main>
    </div>
  );
}
