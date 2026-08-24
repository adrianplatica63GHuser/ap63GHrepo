/**
 * What depends on a reference-data row — the map the SCHEMA does not give us.
 *                                                              (Slice #29.05)
 *
 * WHY THIS EXISTS AT ALL
 *   SIXTEEN foreign keys reach the ELEVEN lookup tables behind Reference Data.
 *   Exactly ONE refuses a delete: `document.document_type_id` is NOT NULL with
 *   no `onDelete` clause, so Postgres' default "no action" blocks it
 *   (src/db/schema/index.ts → `document`). Every other edge does the damage
 *   quietly — ELEVEN are ON DELETE SET NULL, which blanks the tag on the rows
 *   that carried it, and FOUR are CASCADE, deleting whitelist rows outright
 *   (the three on `lookup_person_role` plus `lookup_doc_type_person_role`'s
 *   document-type edge). So for ten lists of eleven, the refusal has to be
 *   written here, in application code, because the database will happily let
 *   the delete through.
 *
 *   Slice #29.13 is what made it eleven. The last two edges —
 *   `property_property.relationship_role_id` and
 *   `document_document.relationship_role_id`, both SET NULL — belonged to two
 *   lists that #29.05 could not reach because they had modals and routes of
 *   their own; deleting a role forty associations carried blanked forty
 *   relationship tags and exited 204. They are now ordinary members of
 *   `VALID_LIST_KEYS` (see ./config.ts for why joining beat guarding twice),
 *   which is why they need nothing here beyond the two entries at the bottom.
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
 * WHAT A MOVE OWES THE OBJECTS IT REWRITES                    (Slice #29.14)
 *   Re-pointing is a write like any other, so `versioned` on a ref says which
 *   entity's version table records that table's history and which column
 *   carries the id it keys on. `reassignDependents` reads it and, for every
 *   row it rewrote, appends a version and stamps `updated_by` — inside the
 *   move's own transaction. EIGHT refs carry it, over four versioned tables
 *   (`property` three times, `document` and `natural_person` twice each,
 *   `judicial_person` once), and the snapshot really does carry the moved
 *   column in each case, which is the whole reason this is owed: see
 *   `snapshot` below, whose registry array is the same fact seen from the
 *   version's side.
 *
 *   FIVE ARE NOT VERSIONED AT ALL, AND THAT IS A FACT, NOT AN OMISSION.
 *   `property_person`, `person_document`, `person_person`, `property_property`
 *   and `document_document` carry no snapshot, no version table and — check
 *   the schema — no `updated_by` and no `updated_at` either: `created_at` is
 *   the only timestamp an association row has ever had. So a move that
 *   re-points a role tag on one of them has nothing to write beyond the tag,
 *   and `versioned` is absent on all five deliberately. Pinned in
 *   value-list-move-history.test.ts so a future `updated_by` on one of them
 *   fails a test rather than being quietly left unstamped.
 *
 *   The four `configuration` refs are never RE-POINTED — `reassignDependents`
 *   skips them — so no version is owed for a move of theirs. They are not
 *   untouched by a move, though, and an adversarial round was right to say the
 *   first draft of this paragraph implied otherwise: a `person-roles` move
 *   INSERTS into `lookup_property_person_role`, `lookup_person_person_role`
 *   and `lookup_doc_type_person_role` through `grantWhitelists` below, on the
 *   move's own transaction. Those three are configuration as well — a tick
 *   saying "this role is allowed here" — so the inserted row IS the record,
 *   and there is nothing further owed. `UNVERSIONED_MOVE_TABLES` covers the
 *   tables a move RE-POINTS, which is a different list from the tables a move
 *   writes.
 *
 * ADDING A CLASS OF DEPENDENT LATER
 *   Slice #29.09 may bind a document type's template field to an entry in one
 *   of these lists, which would make template fields — and the values under
 *   their keys in `document.custom_fields` — a new kind of dependent. That
 *   answer is not needed here and is not waited for. What this shape owes it is
 *   room: `DependentRef` is a discriminated union on `kind`, and today's only
 *   member is `"column"`. A jsonb-shaped dependent arrives as a second member
 *   plus one branch in `countRef` / `moveRef` (queries.ts) — not as a rewrite
 *   of the eleven-way table below.
 */

import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
// ⚠️ **`import type`, and it has to stay one.** `@/db` builds a `pg.Pool` at
// module load; this module is imported by value-list-dependents.test.ts, which
// has no database. A type-only import is erased at compile time, so the handle
// crosses and the pool does not — the same rule responses.ts follows one file
// over, for the same reason.
import type { DbTransaction } from "@/db";
import {
  grantPersonRoleWhitelists,
  type WhitelistGrantOutcome,
} from "./role-whitelists";
import {
  document,
  documentDocument,
  judicialPerson,
  lookupCitizenship,
  lookupDocTypePersonRole,
  lookupDocumentDocumentRole,
  lookupDocumentType,
  lookupInstitution,
  lookupJudicialPersonType,
  lookupPersonPersonRole,
  lookupPersonRole,
  lookupPersonType,
  lookupPropertyPersonRole,
  lookupPropertyPropertyRole,
  lookupPropertyType,
  lookupTarla,
  lookupUseCategory,
  naturalPerson,
  personDocument,
  personPerson,
  property,
  propertyPerson,
  propertyProperty,
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

/**
 * The entities whose history a re-point has to write.           (Slice #29.14)
 *
 * A plain string union rather than a function reference, and that is
 * load-bearing: this module is imported by value-list-dependents.test.ts,
 * which has no database, and the writers live in modules that build a
 * `pg.Pool` at load. The string is resolved to the actual writer in
 * ./move-history.ts, which only `queries.ts` imports — the same reason the
 * `DbTransaction` import above is type-only.
 */
export type VersionedEntityKey =
  | "property"
  | "document"
  | "natural-person"
  | "judicial-person";

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
   * How rows in `table` record their own history.               (Slice #29.14)
   *
   * Present on the eight refs whose table is versioned by full snapshot (four
   * distinct tables), absent
   * on the five association tables that are not versioned and carry no
   * `updated_by` either — see the header. `idColumn` is the column on `table`
   * that holds the versioned object's id, which is `property.id` /
   * `document.id` for the two root entities and `person_id` for both person
   * satellites, because `person_version` keys on `person.id` and the satellite
   * row's FK IS that id.
   *
   * Never set on a `configuration` ref: those are the row's own settings, the
   * mover skips them, and a version of a whitelist tick would be a record of
   * something that never happened.
   */
  versioned?: {
    entity: VersionedEntityKey;
    idColumn: PgColumn;
  };
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
   * `idColumn` for ten lists. For `tarla` it is `indicativ`, because
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
  /**
   * Ticks the TARGET must gain when real rows move onto it.  (Slice #29.13)
   *
   * Declared here rather than branched on inside `reassignDependents` so the
   * mover stays generic: `person-roles` is the only list whose values are
   * gated by a whitelist today, and a second one would be a field on its entry
   * rather than a second `if (list === …)`. Runs inside the move's own
   * transaction, just BEFORE the rows are re-pointed, and returns what it
   * actually created — see ./role-whitelists.ts, which argues at length for
   * why granting a tick here is not the thing #29.05 refused to do.
   */
  grantWhitelists?: (
    tx: DbTransaction,
    from: string,
    to: string,
  ) => Promise<WhitelistGrantOutcome>;
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
        versioned: { entity: "property", idColumn: property.id },
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
        // Versioned all the same: the rows this rewrites ARE properties, and
        // `tarlaSola` is inside the property snapshot. The text match decides
        // WHICH properties move; it changes nothing about what they owe their
        // own history afterwards.                              (Slice #29.14)
        versioned: { entity: "property", idColumn: property.id },
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
        versioned: { entity: "property", idColumn: property.id },
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
        versioned: { entity: "natural-person", idColumn: naturalPerson.personId },
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
    //
    // The one list whose values are gated by a whitelist, so the one list whose
    // move has to leave the moved rows selectable.
    grantWhitelists: grantPersonRoleWhitelists,
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
        versioned: { entity: "natural-person", idColumn: naturalPerson.personId },
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
        versioned: { entity: "judicial-person", idColumn: judicialPerson.personId },
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
        versioned: { entity: "document", idColumn: document.id },
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
        versioned: { entity: "document", idColumn: document.id },
      },
    ],
    snapshot: { keys: DOCUMENT_SNAPSHOT_KEYS, field: "institutionId" },
  },

  // ── The two lists #29.05 did not reach ────────────────────────────────────
  //
  // One SET NULL edge each, and nothing else: no whitelist gates a
  // relationship role (the association screens read the lookup table directly
  // — see `associate-reference-view.tsx` on both sides), so there is no
  // `configuration` ref here and nothing the move has to grant.
  //
  // ⚠️ **No `snapshot`, and it is a fact rather than an omission.** A
  // relationship role lives on the JUNCTION row, exactly as a person role
  // does, and `PROPERTY_SNAPSHOT_PROPERTY_KEYS` / `DOCUMENT_SNAPSHOT_KEYS`
  // carry own fields and addresses — not associations. Pinned in
  // value-list-dependents.test.ts rather than assumed here, the same way
  // `person-roles` is.
  "property-property-roles": {
    table: lookupPropertyPropertyRole,
    idColumn: lookupPropertyPropertyRole.id,
    source: lookupPropertyPropertyRole.id,
    refs: [
      {
        kind: "column",
        labelKey: "propertyProperties",
        table: propertyProperty,
        column: propertyProperty.relationshipRoleId,
        enforcement: "clears",
      },
    ],
  },

  "document-document-roles": {
    table: lookupDocumentDocumentRole,
    idColumn: lookupDocumentDocumentRole.id,
    source: lookupDocumentDocumentRole.id,
    refs: [
      {
        kind: "column",
        labelKey: "documentDocuments",
        table: documentDocument,
        column: documentDocument.relationshipRoleId,
        enforcement: "clears",
      },
    ],
  },
};

/**
 * The tables a move RE-POINTS that record nothing of their own.
 *                                                              (Slice #29.14)
 *
 * "Re-points", not "writes": a `person-roles` move also INSERTS whitelist ticks
 * through `grantWhitelists`, and those three tables are configuration whose
 * inserted row is its own record. See the header.
 *
 * Written down rather than left to be re-derived, because "no `versioned` on
 * this ref" is indistinguishable from "someone forgot" until somebody says
 * which it is. All five are association rows, and they carry no snapshot, no
 * version table, and — check the schema — no `updated_by` and no `updated_at`
 * either: `created_at` is the only timestamp an association row has ever had.
 * So a move that re-points a role tag on one of them owes nothing beyond the
 * tag itself.
 *
 * value-list-move-history.test.ts asserts this list against BOTH the map and
 * the schema, in both directions — so a sixth unversioned ref, or an
 * `updated_by` added to one of these five, fails a test rather than being
 * quietly left unstamped.
 */
export const UNVERSIONED_MOVE_TABLES = [
  "property_person",
  "person_document",
  "person_person",
  "property_property",
  "document_document",
] as const;

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
