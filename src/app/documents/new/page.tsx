import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { DocumentForm } from "../_components/document-form";
import { emptyFormValues, type FormValues } from "../_components/form-schema";
import { canConfigureRoles } from "@/lib/auth/can-configure-roles";
import { db } from "@/db";
import { lookupDocumentType } from "@/db/schema";
import { getPersonById } from "@/lib/persons/queries";
import { isIdentityKind } from "@/lib/identity-documents/kinds";

type PageProps = {
  searchParams: Promise<{ identityKind?: string; holder?: string }>;
};

/**
 * Slice 40.85: „Adaugă act de identitate" on a person opens this screen with `?identityKind=<kind>&holder=<person>`:
 * the type of that kind is chosen, the holder is named under „Act de identitate" and linked once the document is
 * saved, and the person's names, CNP, sex, date and place of birth are filled in (Ask first 3) — each kind's tile
 * shows only its own fields, and saves only those. Nothing is written until „Salvează".
 */
async function identityStart(kind: string | undefined, holderId: string | undefined): Promise<{
  values: FormValues;
  holder: { id: string; code: string; displayName: string };
} | null> {
  if (!isIdentityKind(kind) || !holderId || !/^[0-9a-f-]{36}$/i.test(holderId)) return null;
  const [type] = await db
    .select({ id: lookupDocumentType.id, name: lookupDocumentType.name, shortName: lookupDocumentType.shortName })
    .from(lookupDocumentType)
    .where(eq(lookupDocumentType.identityKind, kind))
    .limit(1);
  const full = await getPersonById(holderId);
  if (!type || !full || full.person.type !== "NATURAL" || !full.natural) return null;
  const n = full.natural;
  return {
    values: {
      ...emptyFormValues,
      documentTypeId: type.id,
      title: `${type.shortName?.trim() || type.name} — ${full.person.displayName}`,
      identity: {
        ...emptyFormValues.identity,
        lastName: n.lastName ?? "",
        firstName: n.firstName ?? "",
        cnp: n.cnp ?? "",
        sex: n.gender ?? "",
        dateOfBirth: n.dateOfBirth ?? "",
        placeOfBirth: n.placeOfBirth ?? "",
      },
    },
    holder: { id: full.person.id, code: full.person.code, displayName: full.person.displayName },
  };
}

export default async function NewDocumentPage({ searchParams }: PageProps) {
  const t = await getTranslations("document");
  // Slice #37.85: only a reader who can configure types (full access; a superuser until #38.21) is told a type has no form, and where to build one.
  const canConfigure = await canConfigureRoles();
  const { identityKind, holder } = await searchParams;
  const start = await identityStart(identityKind, holder);

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <main className="w-full px-6 py-4 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("createTitle")}
          </h1>
        </header>

        <DocumentForm mode="create" canConfigure={canConfigure} initialValues={start?.values} holder={start?.holder ?? null} />
      </main>
    </div>
  );
}
