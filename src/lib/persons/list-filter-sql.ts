/**
 * The two person lists' filter bars, as SQL                                                      (Slice #39.62)
 *
 * One condition per filtered field, ANDed, as the Properties list's (#39.61). Every field is read off `person` and
 * its own satellite (`natural_person` or `judicial_person`) — both list queries already join them — or by a
 * correlated subquery, so neither list query needs a new join:
 *   - „Rol în documente" holds when the person has the role on at least one document (#39.62's Ask first 1);
 *     „(necompletat)" when on none;
 *   - „Localitate" is the HOME address for a natural person, the HEADQUARTERS address for a juridical one (Ask
 *     first 3);
 *   - „Decedat" is a choice: `alive` or `deceased` (Ask first 2; no filter is „toți");
 *   - „Vârstă" is the age shown in the list: at death for the deceased, none for a deceased person with no date.
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
  lookupPersonRole,
  lookupPersonType,
  naturalPerson,
  naturalPersonRelationship,
  person,
  personDocument,
} from "@/db/schema";
import { NONE_VALUE, type FilterState } from "@/lib/list/filter-bar";
import { contains, oneOf, textValue } from "@/lib/list/filter-sql";
import type { PersonListKind } from "./list-filters";

/** The locality of the person's address of `kind`, trimmed — a scalar subquery on `person`. */
function addressLocality(kind: "HOME" | "HEADQUARTERS"): SQL {
  return sql`(SELECT ${textValue(sql`a_f.locality`)} FROM address a_f WHERE a_f.person_id = ${person.id} AND a_f.kind = ${kind})`;
}

/** The age the natural persons list shows (`personAge`): at death for the deceased; none without a birth date. */
export const AGE_SQL = sql`CASE
  WHEN ${naturalPerson.dateOfBirth} IS NULL THEN NULL
  WHEN coalesce(${naturalPerson.isDeceased}, false) AND ${naturalPerson.dateOfDeath} IS NULL THEN NULL
  ELSE extract(year FROM age(coalesce(${naturalPerson.dateOfDeath}, current_date), ${naturalPerson.dateOfBirth}))::int
END`;

/** The person holds one of `ids` as a role on a document, or — with `_none` — no role on any. */
function holdsRole(ids: readonly string[]): SQL | undefined {
  const roles = ids.filter((id) => id !== NONE_VALUE);
  const parts: SQL[] = [];
  if (roles.length > 0) {
    parts.push(sql`EXISTS (
      SELECT 1 FROM ${personDocument} pd_f
      WHERE pd_f.person_id = ${person.id}
        AND pd_f.person_role_id = ANY(ARRAY[${sql.join(roles.map((r) => sql`${r}`), sql`, `)}]::uuid[])
    )`);
  }
  if (ids.includes(NONE_VALUE)) {
    parts.push(sql`NOT EXISTS (
      SELECT 1 FROM ${personDocument} pd_n WHERE pd_n.person_id = ${person.id} AND pd_n.person_role_id IS NOT NULL
    )`);
  }
  return parts.length === 0 ? undefined : parts.length === 1 ? parts[0] : or(...parts);
}

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

/** A company's contact person — either of the two — whose name contains `text`. */
function contactNamed(text: string): SQL {
  return sql`EXISTS (
    SELECT 1 FROM ${person} c_f
    WHERE c_f.id IN (${judicialPerson.contactPerson1Id}, ${judicialPerson.contactPerson2Id})
      AND ${contains(sql`c_f.display_name`, text)}
  )`;
}

/** A list's filters as SQL conditions, one per field. */
export function personFilterConditions(kind: PersonListKind, filters: FilterState): SQL[] {
  const out: SQL[] = [];
  const push = (c: SQL | undefined) => {
    if (c) out.push(c);
  };
  for (const [key, f] of Object.entries(filters)) {
    if (f.kind === "values") {
      if (key === "documentRole") push(holdsRole(f.ids));
      else if (key === "locality") push(oneOf(addressLocality(kind === "NATURAL" ? "HOME" : "HEADQUARTERS"), f.ids));
      else if (kind === "NATURAL" && key === "professionalType") push(oneOf(naturalPerson.physicalPersonTypeId, f.ids));
      else if (kind === "NATURAL" && key === "relationship") push(holdsRelationship(f.ids));
      else if (kind === "NATURAL" && key === "gender") push(oneOf(sql`${naturalPerson.gender}::text`, f.ids));
      else if (kind === "JUDICIAL" && key === "judicialPersonType") push(oneOf(judicialPerson.judicialPersonTypeId, f.ids));
    } else if (f.kind === "choice") {
      if (kind === "NATURAL" && key === "deceased") {
        out.push(sql`coalesce(${naturalPerson.isDeceased}, false) = ${f.value === "deceased"}`);
      }
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
    } else if (f.kind === "text") {
      if (kind === "NATURAL" && key === "cnp") out.push(contains(naturalPerson.cnp, f.text));
      else if (kind === "NATURAL" && key === "placeOfBirth") out.push(contains(naturalPerson.placeOfBirth, f.text));
      else if (kind === "JUDICIAL" && key === "cuiNumber") out.push(contains(judicialPerson.cuiNumber, f.text));
      else if (kind === "JUDICIAL" && key === "tradeRegisterNumber") out.push(contains(judicialPerson.tradeRegisterNumber, f.text));
      else if (kind === "JUDICIAL" && key === "contactPerson") out.push(contactNamed(f.text));
    }
  }
  return out;
}

/**
 * One checklist's facet query: each value, its name, and how many persons of the list hold it, over `where` (the
 * list's own condition, its search and every other filter). „(necompletat)" is the row whose id is NULL. A person
 * counts once under each role they hold.
 */
export function personFacetSql(kind: PersonListKind, field: string, where: SQL | undefined): SQL | null {
  const satellite = kind === "NATURAL"
    ? sql`LEFT JOIN ${naturalPerson} ON ${naturalPerson.personId} = ${person.id}`
    : sql`LEFT JOIN ${judicialPerson} ON ${judicialPerson.personId} = ${person.id}`;
  const own = and(sql`${person.type} = ${kind}`, where);
  const n = sql`count(DISTINCT ${person.id})::int`;
  if (field === "documentRole") {
    // The roles held, then the persons holding none, as „(necompletat)".
    return sql`
      SELECT r_fv.id::text AS id, r_fv.name AS label, ${n} AS n
      FROM ${person} ${satellite}
      JOIN ${personDocument} pd_fv ON pd_fv.person_id = ${person.id}
      JOIN ${lookupPersonRole} r_fv ON r_fv.id = pd_fv.person_role_id
      WHERE ${own}
      GROUP BY r_fv.id, r_fv.name
      UNION ALL
      SELECT NULL AS id, NULL AS label, ${n} AS n
      FROM ${person} ${satellite}
      WHERE ${and(own, holdsRole([NONE_VALUE]))}
      HAVING count(*) > 0`;
  }
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
  if (field === "locality") {
    id = addressLocality(kind === "NATURAL" ? "HOME" : "HEADQUARTERS");
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

/** The names of ticked values no person of the list holds just now — a value list's entries by id. */
export function personFacetNamesSql(kind: PersonListKind, field: string, ids: readonly string[]): SQL | null {
  const arr = sql`ARRAY[${sql.join(ids.map((i) => sql`${i}`), sql`, `)}]::uuid[]`;
  const table =
    field === "documentRole" ? lookupPersonRole :
    kind === "NATURAL" && field === "professionalType" ? lookupPersonType :
    kind === "NATURAL" && field === "relationship" ? lookupPersonRelationship :
    kind === "JUDICIAL" && field === "judicialPersonType" ? lookupJudicialPersonType : null;
  if (!table || ids.length === 0) return null;
  return sql`SELECT ${table.id}::text AS id, ${table.name} AS label FROM ${table} WHERE ${table.id} = ANY(${arr})`;
}
