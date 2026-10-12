/**
 * What the inheritance tree reads — every family tie and the persons it joins.        (Slice #39.11)
 *
 * A tie is a `person_person` pair whose role carries a kinship (#39.10, migration_106). Only natural persons: a pair
 * with a company at either end is not a family tie and is left out. VIEW ONLY: nothing here writes.
 *
 * ⚠️ **NO CNP, NO IDENTITY-CARD FIELD, NO ADDRESS.** The tree shows a name, a nickname, a gender and a birth date at
 * most; this query selects nothing else, so nothing else can reach the screen (TC-INHER-01 step 5 reads the keys).
 *
 * #39.13: and the documents the drawn persons are on — `person_document` rows — with each document's TYPE, NUMBER
 * and DATE only: not its title, which can carry a third party's name, and nothing of its pages.
 */
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { document, lookupDocumentType, lookupPersonRole, naturalPerson, person, personDocument, personPerson } from "@/db/schema";
import type { TreePerson, TreeTie } from "@/lib/inheritance/layout";
import type { TreeAppearance, TreeDocument } from "@/lib/inheritance/documents";

export type InheritanceTreeData = {
  persons: TreePerson[];
  ties: TreeTie[];
  /** #39.13: the documents the persons are on, and who is on which. */
  documents: TreeDocument[];
  appearances: TreeAppearance[];
};

export async function loadInheritanceTree(): Promise<InheritanceTreeData> {
  const pairs = await db
    .select({
      id: personPerson.id,
      personIdA: personPerson.personIdA,
      personIdB: personPerson.personIdB,
      roleReadsAToB: personPerson.roleReadsAToB,
      kinship: lookupPersonRole.kinship,
      name: lookupPersonRole.name,
      converseName: lookupPersonRole.converseName,
      converseNameMale: lookupPersonRole.converseNameMale,
      converseNameFemale: lookupPersonRole.converseNameFemale,
    })
    .from(personPerson)
    .innerJoin(lookupPersonRole, eq(personPerson.relationshipRoleId, lookupPersonRole.id))
    .where(isNotNull(lookupPersonRole.kinship));

  const ids = [...new Set(pairs.flatMap((p) => [p.personIdA, p.personIdB]))];
  const persons: TreePerson[] = ids.length === 0 ? [] : (
    await db
      .select({
        id: person.id,
        displayName: person.displayName,
        firstName: naturalPerson.firstName,
        lastName: naturalPerson.lastName,
        nickname: naturalPerson.nickname,
        gender: naturalPerson.gender,
        dateOfBirth: naturalPerson.dateOfBirth,
      })
      .from(person)
      .innerJoin(naturalPerson, eq(naturalPerson.personId, person.id))
      .where(and(inArray(person.id, ids), eq(person.type, "NATURAL")))
  ).map((p) => ({ ...p, gender: p.gender ?? null }));

  const natural = new Set(persons.map((p) => p.id));
  const ties: TreeTie[] = pairs
    .filter((p) => p.kinship !== null && natural.has(p.personIdA) && natural.has(p.personIdB))
    .map((p) => ({
      id: p.id,
      personIdA: p.personIdA,
      personIdB: p.personIdB,
      roleReadsAToB: p.roleReadsAToB,
      kinship: p.kinship!,
      role: { name: p.name, converseName: p.converseName, converseNameMale: p.converseNameMale, converseNameFemale: p.converseNameFemale },
    }));
  const drawn = persons.filter((p) => ties.some((t) => t.personIdA === p.id || t.personIdB === p.id));
  const { documents, appearances } = await loadDocumentsOf(drawn.map((p) => p.id));
  return { persons: drawn, ties, documents, appearances };
}

/** The documents `personIds` are on (#39.13): type, number and date, and one appearance per person and document. */
async function loadDocumentsOf(personIds: string[]): Promise<{ documents: TreeDocument[]; appearances: TreeAppearance[] }> {
  if (personIds.length === 0) return { documents: [], appearances: [] };
  const appearances = await db
    .selectDistinct({ personId: personDocument.personId, documentId: personDocument.documentId })
    .from(personDocument)
    .where(inArray(personDocument.personId, personIds));
  const docIds = [...new Set(appearances.map((a) => a.documentId))];
  const documents: TreeDocument[] = docIds.length === 0 ? [] : await db
    .select({ id: document.id, type: lookupDocumentType.name, number: document.nrDocument, date: document.dateDocument })
    .from(document)
    .leftJoin(lookupDocumentType, eq(document.documentTypeId, lookupDocumentType.id))
    .where(inArray(document.id, docIds));
  return { documents, appearances };
}
