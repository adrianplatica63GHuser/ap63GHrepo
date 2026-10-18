/**
 * The two person lists' filter bars, as SQL                                                      (Slice #39.62)
 *
 * One condition per filtered field, ANDed, as the Properties list's (#39.61). Every field is read off `person` and
 * its own satellite (`natural_person` or `judicial_person`) — both list queries already join them — or by a
 * correlated subquery, so neither list query needs a new join:
 *   - „Localitate" on the juridical list is the HEADQUARTERS address's locality — the column (#39.82) and the
 *     filter read the same subquery (`headOfficeLocality`);
 *   - „Locul nașterii" is a checklist of the places in use, trimmed, as a locality (#39.82's Ask first 2);
 *   - „Vârstă" is the age shown in the list: at death for the deceased, none for a deceased person with no date.
 * Slice #39.82 kept only the columns Adrian named (`./list-filters`); the role, „Decedat", CNP, home-locality, CUI,
 * trade-register and contact-person conditions went with their filters.
 *
 * Also each checklist's facet query, so the two `queries.ts` only run it — they may quote no snapshot key
 * (object-writers-enumerated.test.ts), and every field's name is one.
 *
 * NO DATABASE — `person-list-filters.test.ts` renders the conditions with `PgDialect`.
 */
import { and, or, sql, type SQL } from "drizzle-orm";
import {
  judicialPerson,
  lookupJudicialPersonType,
  lookupPersonRelationship,
  lookupPersonType,
  naturalPerson,
  naturalPersonRelationship,
  person,
} from "@/db/schema";
import { NONE_VALUE, type FilterState } from "@/lib/list/filter-bar";
import { oneOf, textValue } from "@/lib/list/filter-sql";
import type { PersonListKind } from "./list-filters";

/**
 * A juridical person's head-office locality, trimmed — a scalar subquery on `person`. The list's „Localitate" column
 * (#39.82) reads it, and so do its filter and its checklist, so the three always agree.
 */
export function headOfficeLocality(): SQL {
  return sql`(SELECT ${textValue(sql`a_f.locality`)} FROM address a_f WHERE a_f.person_id = ${person.id} AND a_f.kind = ${"HEADQUARTERS"})`;
}

/** A natural person's place of birth, trimmed, empty as NULL — the „Locul nașterii" checklist's value. */
const PLACE_OF_BIRTH = textValue(naturalPerson.placeOfBirth);

/** The age the natural persons list shows (`personAge`): at death for the deceased; none without a birth date. */
export const AGE_SQL = sql`CASE
  WHEN ${naturalPerson.dateOfBirth} IS NULL THEN NULL
  WHEN coalesce(${naturalPerson.isDeceased}, false) AND ${naturalPerson.dateOfDeath} IS NULL THEN NULL
  ELSE extract(year FROM age(coalesce(${naturalPerson.dateOfDeath}, current_date), ${naturalPerson.dateOfBirth}))::int
END`;

/** Slice #39.70: the person holds one of `ids` in „Relația cu firma", or — with `_none` — none at all. */
function holdsRelationship(ids: readonly string[]): SQL | undefined {
  const values = ids.filter((id) => id !== NONE_VALUE);
  const parts: SQL[] = [];
  if (values.length > 0) {
    parts.push(sql`EXISTS (
      SELECT 1 FROM ${naturalPersonRelationship} npr_f
      WHERE npr_f.natural_person_id = ${person.id}
        AND npr_f.relationship_id = ANY(ARRAY[${sql.join(values.map((r) => sql`${r}`), sql`, `)}]::uuid[])
    )`);
  }
  if (ids.includes(NONE_VALUE)) {
    parts.push(sql`NOT EXISTS (SELECT 1 FROM ${naturalPersonRelationship} npr_n WHERE npr_n.natural_person_id = ${person.id})`);
  }
  return parts.length === 0 ? undefined : parts.length === 1 ? parts[0] : or(...parts);
}

/** A list's filters as SQL conditions, one per field. */
export function personFilterConditions(kind: PersonListKind, filters: FilterState): SQL[] {
  const out: SQL[] = [];
  const push = (c: SQL | undefined) => {
    if (c) out.push(c);
  };
  for (const [key, f] of Object.entries(filters)) {
    if (f.kind === "values") {
      if (kind === "JUDICIAL" && key === "locality") push(oneOf(headOfficeLocality(), f.ids));
      else if (kind === "NATURAL" && key === "professionalType") push(oneOf(naturalPerson.physicalPersonTypeId, f.ids));
      else if (kind === "NATURAL" && key === "relationship") push(holdsRelationship(f.ids));
      else if (kind === "NATURAL" && key === "gender") push(oneOf(sql`${naturalPerson.gender}::text`, f.ids));
      else if (kind === "NATURAL" && key === "placeOfBirth") push(oneOf(PLACE_OF_BIRTH, f.ids));
      else if (kind === "JUDICIAL" && key === "judicialPersonType") push(oneOf(judicialPerson.judicialPersonTypeId, f.ids));
    } else if (f.kind === "range") {
      if (kind === "NATURAL" && key === "age") {
        if (f.from !== null) out.push(sql`${AGE_SQL} >= ${f.from}`);
        if (f.to !== null) out.push(sql`${AGE_SQL} <= ${f.to}`);
      }
    } else if (f.kind === "dates") {
      const col = kind !== "NATURAL" ? null : key === "dateOfBirth" ? naturalPerson.dateOfBirth : key === "dateOfDeath" ? naturalPerson.dateOfDeath : null;
      if (!col) continue;
      if (f.from !== null) out.push(sql`${col} >= ${f.from}::date`);
      if (f.to !== null) out.push(sql`${col} <= ${f.to}::date`);
    }
  }
  return out;
}

/**
 * One checklist's facet query: each value, its name, and how many persons of the list hold it, over `where` (the
 * list's own condition, its search and every other filter). „(necompletat)" is the row whose id is NULL. A person
 * counts once under each relationship they hold.
 */
export function personFacetSql(kind: PersonListKind, field: string, where: SQL | undefined): SQL | null {
  const satellite = kind === "NATURAL"
    ? sql`LEFT JOIN ${naturalPerson} ON ${naturalPerson.personId} = ${person.id}`
    : sql`LEFT JOIN ${judicialPerson} ON ${judicialPerson.personId} = ${person.id}`;
  const own = and(sql`${person.type} = ${kind}`, where);
  const n = sql`count(DISTINCT ${person.id})::int`;
  if (kind === "NATURAL" && field === "relationship") {
    // Slice #39.70: each relationship held, then the persons holding none, as „(necompletat)" — as the roles above.
    return sql`
      SELECT r_fv.id::text AS id, r_fv.name AS label, ${n} AS n
      FROM ${person} ${satellite}
      JOIN ${naturalPersonRelationship} npr_fv ON npr_fv.natural_person_id = ${person.id}
      JOIN ${lookupPersonRelationship} r_fv ON r_fv.id = npr_fv.relationship_id
      WHERE ${own}
      GROUP BY r_fv.id, r_fv.name
      UNION ALL
      SELECT NULL AS id, NULL AS label, ${n} AS n
      FROM ${person} ${satellite}
      WHERE ${and(own, holdsRelationship([NONE_VALUE]))}
      HAVING count(*) > 0`;
  }
  let id: SQL;
  let label: SQL;
  let join = sql``;
  if (kind === "JUDICIAL" && field === "locality") {
    id = headOfficeLocality();
    label = id;
  } else if (kind === "NATURAL" && field === "placeOfBirth") {
    id = PLACE_OF_BIRTH;
    label = id;
  } else if (kind === "NATURAL" && field === "professionalType") {
    join = sql`LEFT JOIN ${lookupPersonType} ON ${lookupPersonType.id} = ${naturalPerson.physicalPersonTypeId}`;
    id = sql`${naturalPerson.physicalPersonTypeId}::text`;
    label = sql`${lookupPersonType.name}`;
  } else if (kind === "NATURAL" && field === "gender") {
    id = sql`${naturalPerson.gender}::text`;
    label = id;
  } else if (kind === "JUDICIAL" && field === "judicialPersonType") {
    join = sql`LEFT JOIN ${lookupJudicialPersonType} ON ${lookupJudicialPersonType.id} = ${judicialPerson.judicialPersonTypeId}`;
    id = sql`${judicialPerson.judicialPersonTypeId}::text`;
    label = sql`${lookupJudicialPersonType.name}`;
  } else {
    return null;
  }
  return sql`
    SELECT ${id} AS id, ${label} AS label, ${n} AS n
    FROM ${person} ${satellite} ${join}
    WHERE ${own}
    GROUP BY 1, 2`;
}

/** The names of ticked values no person of the list holds just now — a value list's entries by id (a text value names itself). */
export function personFacetNamesSql(kind: PersonListKind, field: string, ids: readonly string[]): SQL | null {
  const arr = sql`ARRAY[${sql.join(ids.map((i) => sql`${i}`), sql`, `)}]::uuid[]`;
  const table =
    kind === "NATURAL" && field === "professionalType" ? lookupPersonType :
    kind === "NATURAL" && field === "relationship" ? lookupPersonRelationship :
    kind === "JUDICIAL" && field === "judicialPersonType" ? lookupJudicialPersonType : null;
  if (!table || ids.length === 0) return null;
  return sql`SELECT ${table.id}::text AS id, ${table.name} AS label FROM ${table} WHERE ${table.id} = ANY(${arr})`;
}
