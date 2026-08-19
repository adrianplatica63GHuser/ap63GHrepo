/**
 * What depends on a reference-data row — the map the SCHEMA does not give us.
 *                                                              (Slice #29.05)
 *
 * WHY THIS EXISTS AT ALL
 *   FOURTEEN foreign keys reach the nine lookup tables behind Reference Data
 *   (counted: sixteen point into `lookup_*` tables, and two of those belong to
 *   `lookup_property_property_role` / `lookup_document_document_role`, which
 *   are managed by their own modals and are NOT among the nine — they are
 *   still unguarded, and that is in this slice's handover). Of the fourteen,
 *   exactly ONE refuses a delete: `document.document_type_id` is NOT NULL with
 *   no `onDelete` clause, so Postgres' default "no action" blocks it
 *   (src/db/schema/index.ts → `document`). Every other edge does the damage
 *   quietly — NINE are ON DELETE SET NULL, which blanks the tag on the rows
 *   that carried it, and FOUR are CASCADE, deleting whitelist rows outright
 *   (the three on `lookup_person_role` plus `lookup_doc_type_person_role`'s
 *   document-type edge). So for eight lists of nine, the refusal has to be
 *   written here, in application code, because the database will happily let
 *   the delete through.
 *
 *   The `enforcement` field on each ref records which of the three the database
 *   would do. Nothing branches on it — the refusal is the same either way — but
 *   it is what the tests assert against, and it is why this table is not a
 *   restatement of the schema: it is the list of edges the schema does NOT
 *   protect, with the one that does marked as such.
 *
 * TWO CLASSES OF DEPENDENT THE DATABASE CANNOT SEE, AND WHAT WAS DECIDED
 *   1. **Tarla is text, not a link.** `property.tarla_sola` is free text
 *      (schema line ~416) and `createProperty` auto-seeds a `lookup_tarla` row
 *      from the imported string. So "what uses this tarla" is a string match.
 *      DECIDED: it counts. `tarla`'s ref below matches on the row's own
 *      `indicativ` VALUE rather than on its id — see `source` — and a re-point
 *      rewrites the text in `property`. Counting it is also what stops the
 *      delete being undone by the next import: with no property carrying the
 *      string, nothing re-seeds it.
 *   2. **Version snapshots hold lookup ids inside jsonb, with no FK.**
 *      `document_version.snapshot` carries `documentTypeId` and
 *      `institutionId`; `property_version.snapshot` carries `propertyTypeId`,
 *      `useCategoryId` and `tarlaSola`; `person_version.snapshot` carries
 *      `citizenshipId`, `physicalPersonTypeId`, `judicialPersonTypeId`.
 *      DECIDED: they do NOT count and the screen SAYS SO — see
 *      `dependentNotes` and `valueList.dependents.notes.versionSnapshots`. A
 *      version is a record of what was true when it was saved; re-pointing it
 *      would rewrite history, and deleting the versions would destroy it. What
 *      is not acceptable is a count that silently leaves them out, which is
 *      the failure mode CLAUDE.md's copy-detection story is about.
 *
 *      The note is DERIVED, not asserted: `snapshot.field` is looked up in the
 *      real key array from `snapshot-registry.ts`, so if a snapshot ever stops
 *      carrying the id the sentence stops being printed. The test in the other
 *      direction (that it IS carried today) is in
 *      value-list-dependents.test.ts.
 *
 * ADDING A CLASS OF DEPENDENT LATER
 *   Slice #29.09 may bind a document type's template field to an entry in one
 *   of these lists, which would make template fields — and the values under
 *   their keys in `document.custom_fields` — a new kind of dependent. That
 *   answer is not needed here and is not waited for. What this shape owes it is
 *   room: `DependentRef` is a discriminated union on `kind`, and today's only
 *   member is `"column"`. A jsonb-shaped dependent arrives as a second member
 *   plus one branch in `countRef` / `moveRef` (queries.ts) — not as a rewrite
 *   of the nine-way table below.
 */

import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import {
  document,
  judicialPerson,
  lookupCitizenship,
  lookupDocTypePersonRole,
  lookupDocumentType,
  lookupInstitution,
  lookupJudicialPersonType,
  lookupPersonPersonRole,
  lookupPersonRole,
  lookupPersonType,
  lookupPropertyPersonRole,
  lookupPropertyType,
  lookupTarla,
  lookupUseCategory,
  naturalPerson,
  personDocument,
  personPerson,
  property,
  propertyPerson,
} from "@/db/schema";
import {
  DOCUMENT_SNAPSHOT_KEYS,
  JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS,
  NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS,
  PROPERTY_SNAPSHOT_PROPERTY_KEYS,
} from "@/lib/versioning/snapshot-registry";
import type { ListKey } from "./config";

/** What Postgres itself would do to these rows if the lookup row were deleted. */
export type DbEnforcement =
  /** RESTRICT — the database refuses the delete on its own. One edge only. */
  | "blocks"
  /** ON DELETE SET NULL — the row survives and loses the tag. */
  | "clears"
  /** ON DELETE CASCADE — the row is deleted with the lookup row. */
  | "cascades";

export type DependentRef = {
  kind: "column";
  /** i18n key under `valueList.dependents.classes` — what these objects are. */
  labelKey: string;
  /** The table holding the dependent rows. */
  table: PgTable;
  /** The column on that table carrying the lookup row's value. */
  column: PgColumn;
  enforcement: DbEnforcement;
  /**
   * Is this the row's own CONFIGURATION rather than an object that depends on
   * it?                                            (added by review round 1)
   *
   * ⚠️ **The distinction decides whether the delete is refused, and the first
   * draft got it wrong.** The three person-role whitelists and the
   * document-type half of `lookup_doc_type_person_role` are rows whose entire
   * content is "this role is allowed here" — they are the ticks in the Roluri
   * pe Proprietate / Roluri pe Document panels, not documents or people. The
   * schema says as much where it cascades them: "ON DELETE CASCADE keeps this
   * table clean when a role is removed" (src/db/schema/index.ts, above
   * `lookupPropertyPersonRole`).
   *
   * Counted as a dependent, they made the common case absurd: a role ticked in
   * one panel and used by no association at all was undeletable, and the only
   * remedy offered — move them onto another role — would have granted THAT
   * role an eligibility nobody asked for, in a panel the user was not looking
   * at. So a configuration ref is NAMED ("these go with it") and never
   * blocks, and `reassignDependents` does not touch it.
   *
   * The test that this list is exactly the four whitelist edges is in
   * value-list-dependents.test.ts.
   */
  configuration?: true;
  /**
   * The OTHER columns of a UNIQUE constraint that also covers `column`.
   *
   * Every ref that has one is also `configuration`, and that is not a
   * coincidence: a whitelist is unique over the thing it whitelists, which is
   * the mechanical half of why moving one is not a move at all — an UPDATE
   * onto a role the target already has would be a 23505 rather than a merge.
   * Recorded here because it is the reason, and asserted in the test.
   * `[]` means the FK column is unique on its own.
   */
  uniqueWith?: readonly PgColumn[];
};

export type ListDependencies = {
  /** The lookup table itself — locked and deleted through this. */
  table: PgTable;
  /** Its primary key, for the lock and the delete. */
  idColumn: PgColumn;
  /**
   * The column whose VALUE the dependents carry.
   *
   * `idColumn` for eight lists. For `tarla` it is `indicativ`, because
   * `property.tarla_sola` holds the text and not a foreign key — see the
   * header. Everything downstream (count, re-point) reads this one value and
   * so needs no per-list special case.
   */
  source: PgColumn;
  refs: readonly DependentRef[];
  /**
   * The version snapshot that stores this list's value inside jsonb, if any.
   * `keys` is the real registry array; `field` is checked against it at
   * runtime, so the note can never outlive the fact.
   */
  snapshot?: { keys: readonly string[]; field: string };
  /** Extra i18n note keys, beyond the derived snapshot one. */
  notes?: readonly string[];
};

export const LIST_DEPENDENCIES: Record<ListKey, ListDependencies> = {
  "property-types": {
    table: lookupPropertyType,
    idColumn: lookupPropertyType.id,
    source: lookupPropertyType.id,
    refs: [
      {
        kind: "column",
        labelKey: "properties",
        table: property,
        column: property.propertyTypeId,
        enforcement: "clears",
      },
    ],
    snapshot: { keys: PROPERTY_SNAPSHOT_PROPERTY_KEYS, field: "propertyTypeId" },
  },

  tarla: {
    table: lookupTarla,
    idColumn: lookupTarla.id,
    // The one list matched by value. See the header, decision 1.
    source: lookupTarla.indicativ,
    refs: [
      {
        kind: "column",
        labelKey: "properties",
        table: property,
        column: property.tarlaSola,
        // No foreign key exists at all, so the database neither blocks nor
        // clears nor cascades: it does not know these rows are related.
        // "clears" would be a lie; this is the honest reading of "nothing
        // happens to them, which is the problem".
        enforcement: "clears",
      },
    ],
    snapshot: { keys: PROPERTY_SNAPSHOT_PROPERTY_KEYS, field: "tarlaSola" },
    notes: ["tarlaFreeText"],
  },

  "use-categories": {
    table: lookupUseCategory,
    idColumn: lookupUseCategory.id,
    source: lookupUseCategory.id,
    refs: [
      {
        kind: "column",
        labelKey: "properties",
        table: property,
        column: property.useCategoryId,
        enforcement: "clears",
      },
    ],
    snapshot: { keys: PROPERTY_SNAPSHOT_PROPERTY_KEYS, field: "useCategoryId" },
  },

  "person-types": {
    table: lookupPersonType,
    idColumn: lookupPersonType.id,
    source: lookupPersonType.id,
    refs: [
      {
        kind: "column",
        labelKey: "naturalPersons",
        table: naturalPerson,
        column: naturalPerson.physicalPersonTypeId,
        enforcement: "clears",
      },
    ],
    snapshot: {
      keys: NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS,
      field: "physicalPersonTypeId",
    },
  },

  // The worst case in the schema, and the reason the person-roles section of
  // value-list-dependents.test.ts exists: six inbound edges, THREE of them CASCADE. Deleting a role with nothing
  // in the way of it removes its rows from all three whitelists and blanks the
  // role tag on property_person, person_document and person_person — six
  // tables damaged by one unguarded click.
  "person-roles": {
    table: lookupPersonRole,
    idColumn: lookupPersonRole.id,
    source: lookupPersonRole.id,
    refs: [
      {
        kind: "column",
        labelKey: "propertyPersons",
        table: propertyPerson,
        column: propertyPerson.personRoleId,
        enforcement: "clears",
      },
      {
        kind: "column",
        labelKey: "personDocuments",
        table: personDocument,
        column: personDocument.personRoleId,
        enforcement: "clears",
      },
      {
        kind: "column",
        labelKey: "personPersons",
        table: personPerson,
        column: personPerson.relationshipRoleId,
        enforcement: "clears",
      },
      {
        kind: "column",
        labelKey: "propertyPersonRoleWhitelist",
        table: lookupPropertyPersonRole,
        column: lookupPropertyPersonRole.personRoleId,
        enforcement: "cascades",
        configuration: true,
        // `.unique()` on the column itself.
        uniqueWith: [],
      },
      {
        kind: "column",
        labelKey: "docTypePersonRoleWhitelist",
        table: lookupDocTypePersonRole,
        column: lookupDocTypePersonRole.personRoleId,
        enforcement: "cascades",
        configuration: true,
        uniqueWith: [lookupDocTypePersonRole.documentTypeId],
      },
      {
        kind: "column",
        labelKey: "personPersonRoleWhitelist",
        table: lookupPersonPersonRole,
        column: lookupPersonPersonRole.personRoleId,
        enforcement: "cascades",
        configuration: true,
        uniqueWith: [],
      },
    ],
    // No snapshot carries a role id: roles live on junction rows, and the
    // person/property/document snapshots hold own fields and addresses only.
    // Checked in value-list-dependents.test.ts rather than assumed here.
  },

  citizenships: {
    table: lookupCitizenship,
    idColumn: lookupCitizenship.id,
    source: lookupCitizenship.id,
    refs: [
      {
        kind: "column",
        labelKey: "naturalPersons",
        table: naturalPerson,
        column: naturalPerson.citizenshipId,
        enforcement: "clears",
      },
    ],
    snapshot: { keys: NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS, field: "citizenshipId" },
  },

  "judicial-person-types": {
    table: lookupJudicialPersonType,
    idColumn: lookupJudicialPersonType.id,
    source: lookupJudicialPersonType.id,
    refs: [
      {
        kind: "column",
        labelKey: "judicialPersons",
        table: judicialPerson,
        column: judicialPerson.judicialPersonTypeId,
        enforcement: "clears",
      },
    ],
    snapshot: {
      keys: JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS,
      field: "judicialPersonTypeId",
    },
  },

  // The one list the database protects — and only on its FIRST edge. The
  // second is a CASCADE that would silently empty the "Roluri pe Document"
  // whitelist for the type, which is why it is listed here even though the
  // delete could never reach it while a document exists.
  "document-types": {
    table: lookupDocumentType,
    idColumn: lookupDocumentType.id,
    source: lookupDocumentType.id,
    refs: [
      {
        kind: "column",
        labelKey: "documents",
        table: document,
        column: document.documentTypeId,
        enforcement: "blocks",
      },
      {
        kind: "column",
        labelKey: "docTypePersonRoleWhitelist",
        table: lookupDocTypePersonRole,
        column: lookupDocTypePersonRole.documentTypeId,
        enforcement: "cascades",
        configuration: true,
        uniqueWith: [lookupDocTypePersonRole.personRoleId],
      },
    ],
    snapshot: { keys: DOCUMENT_SNAPSHOT_KEYS, field: "documentTypeId" },
  },

  institutions: {
    table: lookupInstitution,
    idColumn: lookupInstitution.id,
    source: lookupInstitution.id,
    refs: [
      {
        kind: "column",
        labelKey: "documents",
        table: document,
        column: document.institutionId,
        enforcement: "clears",
      },
    ],
    snapshot: { keys: DOCUMENT_SNAPSHOT_KEYS, field: "institutionId" },
  },
};

/** One class of dependent and how many of them there are. */
export type DependentCount = {
  /** i18n key under `valueList.dependents.classes`. */
  labelKey: string;
  count: number;
};

/** What the server says about a row a user is trying to delete. */
export type DependentsReport = {
  /** The blocking count. Zero means the delete is offered. */
  total: number;
  /** Only the blocking classes with a non-zero count, in map order. */
  dependents: DependentCount[];
  /**
   * Configuration that goes WITH the row when it is deleted — whitelist ticks,
   * not objects. Never blocks; always disclosed, because it disappears without
   * anyone asking for it (the database cascades it).
   */
  removedWithRow: DependentCount[];
  /** i18n keys under `valueList.dependents.notes` — what the count does NOT cover. */
  notes: string[];
};

/**
 * Is this list matched by VALUE rather than by id? True for `tarla` alone.
 *
 * Derived rather than declared, so it cannot disagree with the `source` the
 * counting actually uses.
 */
export function matchesByValue(def: ListDependencies): boolean {
  return def.source !== def.idColumn;
}

/**
 * The notes for a list: what the count above cannot see.
 *
 * The snapshot note is derived from the registry array rather than written
 * down, so it disappears by itself the day a snapshot stops carrying the id —
 * a note that outlived its fact would be exactly the "confident output never
 * measured" defect this repo keeps catching.
 */
export function dependentNotes(list: ListKey): string[] {
  const def = LIST_DEPENDENCIES[list];
  const out: string[] = [];
  if (def.snapshot && def.snapshot.keys.includes(def.snapshot.field)) {
    out.push("versionSnapshots");
  }
  for (const n of def.notes ?? []) out.push(n);
  return out;
}
