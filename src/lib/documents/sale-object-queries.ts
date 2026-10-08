/**
 * What „Obiectul vânzării"'s description is composed from, read from the
 * database (Slice #38.49): the contract's properties with their names joined,
 * its parties, and its stored „Scop vânzare". The composing itself is pure —
 * `sale-object-description.ts`.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  document,
  lookupPropertyType,
  lookupTarla,
  lookupUseCategory,
  property,
  propertyAddress,
  propertyDocument,
} from "@/db/schema";
import { listDocumentPersons } from "./queries";
import { composeSaleObjectDescription, type SaleObjectProperty } from "./sale-object-description";

/** The contract's properties, each with what the description reads. */
export async function listSaleObjectProperties(documentId: string): Promise<SaleObjectProperty[]> {
  return db
    .select({
      propertyType:     lookupPropertyType.name,
      useCategory:      lookupUseCategory.name,
      surfaceAreaMp:    property.surfaceAreaMp,
      calculatedAreaMp: property.calculatedAreaMp,
      tarla:            lookupTarla.indicativ,
      parcela:          property.parcela,
      cadastralNumber:  property.cadastralNumber,
      carteFunciara:    property.carteFunciara,
      locality:         propertyAddress.locality,
    })
    .from(propertyDocument)
    .innerJoin(property, eq(propertyDocument.propertyId, property.id))
    // LEFT: a property may carry none of these (#34.03's reason).
    .leftJoin(lookupPropertyType, eq(lookupPropertyType.id, property.propertyTypeId))
    .leftJoin(lookupUseCategory, eq(lookupUseCategory.id, property.useCategoryId))
    .leftJoin(lookupTarla, eq(lookupTarla.id, property.tarlaId))
    .leftJoin(propertyAddress, eq(propertyAddress.propertyId, property.id))
    .where(eq(propertyDocument.documentId, documentId))
    .orderBy(property.code);
}

/**
 * The description of what the contract sells. `scopVanzare` is the screen's
 * value when it passes one (the user may have changed it and not saved yet);
 * otherwise the stored one. `null` when the document does not exist.
 */
export async function composeSaleObjectFor(documentId: string, scopVanzare?: string | null): Promise<string | null> {
  const [doc] = await db.select({ customFields: document.customFields }).from(document).where(eq(document.id, documentId)).limit(1);
  if (!doc) return null;
  const stored = (doc.customFields as Record<string, unknown> | null)?.scopVanzare;
  const [properties, parties] = await Promise.all([listSaleObjectProperties(documentId), listDocumentPersons(documentId)]);
  return composeSaleObjectDescription({
    properties,
    parties,
    scopVanzare: scopVanzare !== undefined ? scopVanzare : typeof stored === "string" ? stored : null,
  });
}
