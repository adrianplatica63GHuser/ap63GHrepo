/**
 * Snapshot Schema Registry  (Slice #19.20)
 *
 * Single source of truth for the key sets of every versioned JSONB snapshot
 * in this application. Each versioned entity stores its snapshot in an
 * untyped `jsonb` column; the shape is defined in TypeScript (in the entity's
 * validation.ts) and mirrored in SQL (in the migration's `jsonb_build_object`
 * backfill). Without a registry, those two definitions can silently diverge.
 *
 * HOW TO USE THIS FILE
 * --------------------
 * 1. Add a field to a *Snapshot type in validation.ts (or metadata/queries.ts).
 * 2. Add the matching key string to the corresponding array below.
 *    → The `AssertExactKeys` compile-time check will fail at `npm run lint`
 *      (tsc) if the array and the TypeScript type disagree in either direction.
 * 3. Add the matching key to the `jsonb_build_object` in the new migration's
 *    backfill SQL.  Comment the migration file with:
 *      -- Snapshot keys: see src/lib/versioning/snapshot-registry.ts
 *    This is the ONLY step that cannot be enforced automatically — the
 *    comment convention and code review are the safeguard here.
 *
 * The runtime Jest test (src/__tests__/snapshot-registry.test.ts) provides a
 * second, CI-visible check: it instantiates fully-typed dummy objects and
 * asserts their keys match the arrays below.
 *
 * COMPILE-TIME GUARD
 * ------------------
 * `AssertExactKeys<T, Keys>` evaluates to `true` when Keys is EXACTLY the set
 * of keys of T (no missing, no extra). It evaluates to `never` when they
 * differ, so assigning `true` to a variable of that type is a TypeScript
 * error — caught at build time.
 */

import type {
  PropertySnapshotProperty,
  PropertySnapshotAddress,
  PropertySnapshotCorner,
} from "@/lib/properties/validation";
import type {
  NaturalPersonSnapshotFields,
  PersonAddressSnapshot,
} from "@/lib/persons/validation";
import type { JudicialPersonSnapshotFields } from "@/lib/judicial-persons/validation";
import type { DocumentSnapshot } from "@/lib/documents/validation";
import type { MetadataSnapshot } from "@/lib/metadata/queries";

// ---------------------------------------------------------------------------
// Compile-time exhaustiveness helper
// ---------------------------------------------------------------------------

/**
 * Resolves to `true` when `Keys` contains EXACTLY the keys of `T` — no
 * missing, no extra. Resolves to `never` otherwise, making the assignment
 * `const _check: AssertExactKeys<T, Keys> = true` a compile error.
 *
 * Both directions are checked:
 *   Keys[number] extends keyof T  → no key in the array is foreign to T
 *   keyof T extends Keys[number]  → no key of T is absent from the array
 */
type AssertExactKeys<
  T,
  Keys extends ReadonlyArray<keyof T>,
> = Keys[number] extends keyof T
  ? keyof T extends Keys[number]
    ? true
    : never
  : never;

// ---------------------------------------------------------------------------
// Property snapshot
// ---------------------------------------------------------------------------
// Matches: PropertySnapshotProperty in src/lib/properties/validation.ts
// Backfill: migration_029_property_versions.sql  (jsonb_build_object)

export const PROPERTY_SNAPSHOT_PROPERTY_KEYS = [
  "propertyTypeId",
  "nickname",
  "tarlaSola",
  "parcela",
  "cadastralNumber",
  "carteFunciara",
  "useCategoryId",
  "surfaceAreaMp",
  "calculatedAreaMp",
  "notes",
] as const satisfies ReadonlyArray<keyof PropertySnapshotProperty>;

declare const _propPropertyCheck: AssertExactKeys<
  PropertySnapshotProperty,
  typeof PROPERTY_SNAPSHOT_PROPERTY_KEYS
>;

// ---------------------------------------------------------------------------
// Property address snapshot
// ---------------------------------------------------------------------------
// Matches: PropertySnapshotAddress in src/lib/properties/validation.ts
// Backfill: migration_029_property_versions.sql

export const PROPERTY_SNAPSHOT_ADDRESS_KEYS = [
  "streetLine",
  "postalCode",
  "locality",
  "county",
  "country",
  "notes",
  "streetViewStreetLine",
] as const satisfies ReadonlyArray<keyof PropertySnapshotAddress>;

declare const _propAddressCheck: AssertExactKeys<
  PropertySnapshotAddress,
  typeof PROPERTY_SNAPSHOT_ADDRESS_KEYS
>;

// ---------------------------------------------------------------------------
// Property corner snapshot
// ---------------------------------------------------------------------------
// Matches: PropertySnapshotCorner in src/lib/properties/validation.ts
// Backfill: migration_029_property_versions.sql

export const PROPERTY_SNAPSHOT_CORNER_KEYS = [
  "lat",
  "lon",
  "originalIndex",
] as const satisfies ReadonlyArray<keyof PropertySnapshotCorner>;

declare const _propCornerCheck: AssertExactKeys<
  PropertySnapshotCorner,
  typeof PROPERTY_SNAPSHOT_CORNER_KEYS
>;

// ---------------------------------------------------------------------------
// Natural person snapshot fields
// ---------------------------------------------------------------------------
// Matches: NaturalPersonSnapshotFields in src/lib/persons/validation.ts
// Backfill: migration_030_person_versions.sql  (NATURAL case)

export const NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS = [
  "firstName",
  "lastName",
  "nickname",
  "cnp",
  "idDocumentType",
  "idDocumentNumber",
  "gender",
  "dateOfBirth",
  "personalPhone1",
  "personalPhone2",
  "workPhone",
  "personalEmail1",
  "personalEmail2",
  "workEmail",
  "placeOfBirth",
  "idIssuingAuthority",
  "idValidFrom",
  "idValidUntil",
  "idCardNumber",
  "idMrzRaw",
  "citizenshipId",
  "physicalPersonTypeId",
  "correspondenceSameAsHome",
] as const satisfies ReadonlyArray<keyof NaturalPersonSnapshotFields>;

declare const _naturalFieldsCheck: AssertExactKeys<
  NaturalPersonSnapshotFields,
  typeof NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS
>;

// ---------------------------------------------------------------------------
// Person address snapshot (shared by Natural and Judicial)
// ---------------------------------------------------------------------------
// Matches: PersonAddressSnapshot in src/lib/persons/validation.ts
// Backfill: migration_030_person_versions.sql

export const PERSON_ADDRESS_SNAPSHOT_KEYS = [
  "streetLine",
  "postalCode",
  "locality",
  "county",
  "country",
  "notes",
] as const satisfies ReadonlyArray<keyof PersonAddressSnapshot>;

declare const _personAddressCheck: AssertExactKeys<
  PersonAddressSnapshot,
  typeof PERSON_ADDRESS_SNAPSHOT_KEYS
>;

// ---------------------------------------------------------------------------
// Judicial person snapshot fields
// ---------------------------------------------------------------------------
// Matches: JudicialPersonSnapshotFields in src/lib/judicial-persons/validation.ts
// Backfill: migration_030_person_versions.sql  (JUDICIAL case)

export const JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS = [
  "name",
  "nickname",
  "judicialPersonTypeId",
  "cuiNumber",
  "tradeRegisterNumber",
  "contactPerson1Id",
  "contactPerson2Id",
  "correspondenceSameAsHq",
] as const satisfies ReadonlyArray<keyof JudicialPersonSnapshotFields>;

declare const _judicialFieldsCheck: AssertExactKeys<
  JudicialPersonSnapshotFields,
  typeof JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS
>;

// ---------------------------------------------------------------------------
// Document snapshot
// ---------------------------------------------------------------------------
// Matches: DocumentSnapshot in src/lib/documents/validation.ts
// Backfill: migration_031_document_versions.sql

export const DOCUMENT_SNAPSHOT_KEYS = [
  "documentTypeId",
  "title",
  "nrDocument",
  "dateDocument",
  "institutionId",
  "emitent",
  "bazaLegala",
  "uatProprietate",
  "uatProprietar",
  "suprafata",
  "nrDosarSuccesoral",
  "dataDecesului",
  "ultimulDomiciliu",
  "nrCertificatDeces",
  "dateStart",
  "dateEnd",
  "notes",
  "subject",
  "dateValidUntil",
  "surveyorId",
] as const satisfies ReadonlyArray<keyof DocumentSnapshot>;

declare const _documentCheck: AssertExactKeys<
  DocumentSnapshot,
  typeof DOCUMENT_SNAPSHOT_KEYS
>;

// ---------------------------------------------------------------------------
// Entity metadata snapshot
// ---------------------------------------------------------------------------
// Matches: MetadataSnapshot in src/lib/metadata/queries.ts
// Backfill: migration_047_metadata_fixes.sql  (entity_metadata_version backfill)

export const METADATA_SNAPSHOT_KEYS = [
  "importance",
  "relevance",
  "provenance",
] as const satisfies ReadonlyArray<keyof MetadataSnapshot>;

declare const _metadataCheck: AssertExactKeys<
  MetadataSnapshot,
  typeof METADATA_SNAPSHOT_KEYS
>;
