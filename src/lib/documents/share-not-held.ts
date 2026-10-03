/**
 * The refusal of a share for a role that holds none.             (Slice #37.59)
 *
 * A link's role holds a share in the property only where its document type
 * says so — `lookup_doc_type_person_role.holds_share`, migration_091. Every
 * write of `person_document`'s three share columns asks `assertShareMayBeStored`
 * first, so a Notar or a Proiectant / Consultant cannot be given a cotă by any
 * route, however the request was made. Clearing the values (all three null)
 * is always allowed — it is how a value stored before migration_091 is removed.
 *
 * The four write paths: POST /api/documents/[id]/persons and its PATCH
 * (`associatePersonsToDocument`, `updateDocumentPersonCota`), and the person
 * side's POST /api/people/[id]/documents and PATCH
 * (`associateDocumentsToPerson`, `updatePersonDocumentCota`). Each route turns
 * the error into a 400 with `code: "SHARE_NOT_HELD"` (`shareNotHeldToResponse`).
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { document, lookupDocTypePersonRole, personDocument } from "@/db/schema";
import { storesShare } from "./share-cells";
import { ShareNotHeldError } from "./share-not-held-error";

export { ShareNotHeldError } from "./share-not-held-error";

export type ShareInput = {
  cotaParte?:       number | null;
  cotaSuprafataMp?: number | null;
  cotaMod?:         string | null;
};

const asRow = (c: ShareInput) => ({
  cotaParte:       c.cotaParte ?? null,
  cotaSuprafataMp: c.cotaSuprafataMp ?? null,
  cotaMod:         c.cotaMod ?? null,
});

/**
 * Throws `ShareNotHeldError` when `cota` sets a value and `personRoleId`, on
 * the type of any of `documentIds`, holds no share. No role, or no value, is
 * never refused.
 */
export async function assertShareMayBeStored(
  documentIds:  readonly string[],
  personRoleId: string | null,
  cota:         ShareInput,
): Promise<void> {
  if (personRoleId === null || !storesShare(asRow(cota)) || documentIds.length === 0) return;
  const holding = await db
    .select({ id: document.id })
    .from(document)
    .innerJoin(
      lookupDocTypePersonRole,
      and(
        eq(lookupDocTypePersonRole.documentTypeId, document.documentTypeId),
        eq(lookupDocTypePersonRole.personRoleId, personRoleId),
        eq(lookupDocTypePersonRole.holdsShare, true),
      ),
    )
    .where(inArray(document.id, [...documentIds]));
  const held = new Set(holding.map((r) => r.id));
  const refused = documentIds.filter((id) => !held.has(id));
  if (refused.length > 0) throw new ShareNotHeldError(refused, personRoleId);
}

/** The same question for one existing link, addressed by its row id. */
export async function assertLinkMayStoreShare(linkId: string, cota: ShareInput): Promise<void> {
  if (!storesShare(asRow(cota))) return;
  const [link] = await db
    .select({ documentId: personDocument.documentId, personRoleId: personDocument.personRoleId })
    .from(personDocument)
    .where(eq(personDocument.id, linkId))
    .limit(1);
  // A missing link is the caller's 404, answered by its own UPDATE.
  if (!link) return;
  await assertShareMayBeStored([link.documentId], link.personRoleId, cota);
}
