/**
 * The juridical persons a document's issuer is picked from.                              (Slice #39.72)
 *
 * Read-only. `listIssuers()` without a search is the picker's list — the juridical persons of a public-body type
 * (`lookup_judicial_person_type.public_body`); with a search it is every juridical person the search finds (name,
 * nickname, code, CUI — the list's own condition), public-body ones first. A new issuer is made through the ordinary
 * create route (POST /api/judicial-persons), so this module writes nothing: one create path for juridical persons.
 */
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { judicialPerson, lookupJudicialPersonType, person } from "@/db/schema";
import { judicialPersonSearchCondition } from "@/lib/judicial-persons/queries";
import type { IssuerOption, PublicBodyType } from "./issuer";

/** At most this many persons answer a search: the dialog shows them on one page. */
export const ISSUER_SEARCH_LIMIT = 25;

export async function listIssuers(q?: string): Promise<IssuerOption[]> {
  const search = judicialPersonSearchCondition(q);
  const rows = await db
    .select({
      id:          person.id,
      code:        person.code,
      displayName: person.displayName,
      typeName:    lookupJudicialPersonType.name,
      publicBody:  lookupJudicialPersonType.publicBody,
      cuiNumber:   judicialPerson.cuiNumber,
    })
    .from(person)
    .innerJoin(judicialPerson, eq(judicialPerson.personId, person.id))
    .leftJoin(lookupJudicialPersonType, eq(lookupJudicialPersonType.id, judicialPerson.judicialPersonTypeId))
    .where(
      search
        ? and(eq(person.type, "JUDICIAL"), search)
        : and(eq(person.type, "JUDICIAL"), eq(lookupJudicialPersonType.publicBody, true)),
    )
    .orderBy(desc(lookupJudicialPersonType.publicBody), asc(person.displayName), asc(person.code))
    .limit(search ? ISSUER_SEARCH_LIMIT : 1000);
  return rows.map((r) => ({ ...r, publicBody: r.publicBody === true }));
}

/** The public-body types, for the type a new issuer's name suggests (`publicBodyTypeIdFor`). */
export async function listPublicBodyTypes(): Promise<PublicBodyType[]> {
  return db
    .select({ id: lookupJudicialPersonType.id, name: lookupJudicialPersonType.name })
    .from(lookupJudicialPersonType)
    .where(eq(lookupJudicialPersonType.publicBody, true))
    .orderBy(asc(lookupJudicialPersonType.sortOrder), asc(lookupJudicialPersonType.name));
}

/** The issuer's name, for the picker's current value when the list does not hold it. */
export async function issuerName(personId: string | null | undefined): Promise<string | null> {
  if (!personId) return null;
  const rows = await db.select({ displayName: person.displayName }).from(person).where(eq(person.id, personId)).limit(1);
  return rows[0]?.displayName ?? null;
}
