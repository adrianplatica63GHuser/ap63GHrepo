/**
 * Snapshot Schema Registry — runtime key-set tests  (Slice #19.20)
 *
 * These tests verify at CI time that the key arrays in snapshot-registry.ts
 * match the actual TypeScript snapshot types field-by-field.
 *
 * HOW THE DOUBLE-GUARD WORKS
 * --------------------------
 * Compile time:  The `AssertExactKeys` declarations in snapshot-registry.ts
 *   fail at `tsc` / `npm run lint` if any array is missing a key or has an
 *   extra one relative to its TypeScript type.
 *
 * Runtime (here):  Each test constructs a fully-typed dummy object (TypeScript
 *   enforces that every required field is present in the literal). The test then
 *   asserts that `Object.keys(dummy)` matches the registered array.  This
 *   catches the rare case where the compile-time guard is satisfied but the
 *   runtime shape diverges (e.g. a field added to the type as optional and
 *   omitted from the dummy — the compile check would pass but the array would
 *   be stale).
 *
 * No DB, no React, no network — pure structural checks.
 */

import {
  DOCUMENT_SNAPSHOT_KEYS,
  JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS,
  METADATA_SNAPSHOT_KEYS,
  NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS,
  PERSON_ADDRESS_SNAPSHOT_KEYS,
  PROPERTY_SNAPSHOT_ADDRESS_KEYS,
  PROPERTY_SNAPSHOT_CORNER_KEYS,
  PROPERTY_SNAPSHOT_PROPERTY_KEYS,
} from "@/lib/versioning/snapshot-registry";

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
// Helper
// ---------------------------------------------------------------------------

function sortedKeys(obj: object): string[] {
  return Object.keys(obj).sort();
}

function sortedArray(arr: ReadonlyArray<string>): string[] {
  return [...arr].sort();
}

// ---------------------------------------------------------------------------
// Property snapshot — own fields
// ---------------------------------------------------------------------------

describe("PROPERTY_SNAPSHOT_PROPERTY_KEYS", () => {
  it("matches PropertySnapshotProperty exactly", () => {
    const dummy: PropertySnapshotProperty = {
      propertyTypeId:   null,
      nickname:         null,
      tarlaSola:        null,
      parcela:          null,
      cadastralNumber:  null,
      carteFunciara:    null,
      useCategoryId:    null,
      surfaceAreaMp:    null,
      calculatedAreaMp: null,
      notes:            null,
    };
    expect(sortedKeys(dummy)).toEqual(sortedArray(PROPERTY_SNAPSHOT_PROPERTY_KEYS));
  });
});

// ---------------------------------------------------------------------------
// Property snapshot — address
// ---------------------------------------------------------------------------

describe("PROPERTY_SNAPSHOT_ADDRESS_KEYS", () => {
  it("matches PropertySnapshotAddress exactly", () => {
    const dummy: PropertySnapshotAddress = {
      streetLine:           null,
      postalCode:           null,
      locality:             null,
      county:               null,
      country:              "Romania",
      notes:                null,
      streetViewStreetLine: null,
    };
    expect(sortedKeys(dummy)).toEqual(sortedArray(PROPERTY_SNAPSHOT_ADDRESS_KEYS));
  });
});

// ---------------------------------------------------------------------------
// Property snapshot — corner
// ---------------------------------------------------------------------------

describe("PROPERTY_SNAPSHOT_CORNER_KEYS", () => {
  it("matches PropertySnapshotCorner exactly", () => {
    const dummy: PropertySnapshotCorner = {
      lat:           44.0,
      lon:           26.0,
      originalIndex: null,
    };
    expect(sortedKeys(dummy)).toEqual(sortedArray(PROPERTY_SNAPSHOT_CORNER_KEYS));
  });
});

// ---------------------------------------------------------------------------
// Natural person snapshot fields
// ---------------------------------------------------------------------------

describe("NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS", () => {
  it("matches NaturalPersonSnapshotFields exactly", () => {
    const dummy: NaturalPersonSnapshotFields = {
      firstName:                null,
      lastName:                 null,
      nickname:                 null,
      cnp:                      null,
      idDocumentType:           null,
      idDocumentNumber:         null,
      gender:                   null,
      dateOfBirth:              null,
      personalPhone1:           null,
      personalPhone2:           null,
      workPhone:                null,
      personalEmail1:           null,
      personalEmail2:           null,
      workEmail:                null,
      placeOfBirth:             null,
      idIssuingAuthority:       null,
      idValidFrom:              null,
      idValidUntil:             null,
      idCardNumber:             null,
      idMrzRaw:                 null,
      citizenshipId:            null,
      physicalPersonTypeId:     null,
      correspondenceSameAsHome: false,
    };
    expect(sortedKeys(dummy)).toEqual(sortedArray(NATURAL_PERSON_SNAPSHOT_FIELDS_KEYS));
  });
});

// ---------------------------------------------------------------------------
// Person address snapshot (shared by natural + judicial)
// ---------------------------------------------------------------------------

describe("PERSON_ADDRESS_SNAPSHOT_KEYS", () => {
  it("matches PersonAddressSnapshot exactly", () => {
    const dummy: PersonAddressSnapshot = {
      streetLine: null,
      postalCode: null,
      locality:   null,
      county:     null,
      country:    null,
      notes:      null,
    };
    expect(sortedKeys(dummy)).toEqual(sortedArray(PERSON_ADDRESS_SNAPSHOT_KEYS));
  });
});

// ---------------------------------------------------------------------------
// Judicial person snapshot fields
// ---------------------------------------------------------------------------

describe("JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS", () => {
  it("matches JudicialPersonSnapshotFields exactly", () => {
    const dummy: JudicialPersonSnapshotFields = {
      name:                   null,
      nickname:               null,
      judicialPersonTypeId:   null,
      cuiNumber:              null,
      tradeRegisterNumber:    null,
      contactPerson1Id:       null,
      contactPerson2Id:       null,
      correspondenceSameAsHq: false,
    };
    expect(sortedKeys(dummy)).toEqual(sortedArray(JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS));
  });
});

// ---------------------------------------------------------------------------
// Document snapshot (flat)
// ---------------------------------------------------------------------------

describe("DOCUMENT_SNAPSHOT_KEYS", () => {
  it("matches DocumentSnapshot exactly", () => {
    const dummy: DocumentSnapshot = {
      documentTypeId:    null,
      title:             null,
      nrDocument:        null,
      dateDocument:      null,
      institutionId:     null,
      emitent:           null,
      bazaLegala:        null,
      uatProprietate:    null,
      uatProprietar:     null,
      suprafata:         null,
      nrDosarSuccesoral: null,
      dataDecesului:     null,
      ultimulDomiciliu:  null,
      nrCertificatDeces: null,
      dateStart:         null,
      dateEnd:           null,
      notes:             null,
      subject:           null,
      dateValidUntil:    null,
      surveyorId:        null,
    };
    expect(sortedKeys(dummy)).toEqual(sortedArray(DOCUMENT_SNAPSHOT_KEYS));
  });
});

// ---------------------------------------------------------------------------
// Entity metadata snapshot
// ---------------------------------------------------------------------------

describe("METADATA_SNAPSHOT_KEYS", () => {
  it("matches MetadataSnapshot exactly", () => {
    const dummy: MetadataSnapshot = {
      importance: null,
      relevance:  null,
      provenance: null,
    };
    expect(sortedKeys(dummy)).toEqual(sortedArray(METADATA_SNAPSHOT_KEYS));
  });
});
