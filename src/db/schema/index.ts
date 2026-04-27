import { sql } from "drizzle-orm";
import {
  check,
  date,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const personTypeEnum = pgEnum("person_type", ["NATURAL", "JUDICIAL"]);

export const addressKindEnum = pgEnum("address_kind", [
  "HOME",
  "POSTAL",
  "HEADQUARTERS",
  "CORRESPONDENCE",
]);

export const idDocumentTypeEnum = pgEnum("id_document_type", [
  "ID_CARD",
  "PASSPORT",
]);

export const genderEnum = pgEnum("gender", ["MALE", "FEMALE"]);

// ---------------------------------------------------------------------------
// person — base / supertype
// ---------------------------------------------------------------------------
//
// Holds everything true of any person (natural or judicial). All M:M junction
// tables FK to `person.id` and never need to know the subtype.

export const person = pgTable("person", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Public, human-readable ID like "PERS00001". Default expression uses a
  // Postgres SEQUENCE created in the migration. Once set, it never changes
  // (regenerating the sequence on each insert means stable IDs forever).
  code: text("code")
    .notNull()
    .unique()
    .default(
      sql`'PERS' || lpad(nextval('person_code_seq')::text, 5, '0')`,
    ),

  type: personTypeEnum("type").notNull(),

  // Cached display name — populated by API code on insert/update from the
  // subtype (first_name + last_name for natural; company name for judicial
  // when that lands in Slice #1.5). Used by the list view and search.
  displayName: text("display_name").notNull(),

  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// natural_person — subtype for humans
// ---------------------------------------------------------------------------
//
// 1:1 with `person`. PK is also FK to person.id with ON DELETE CASCADE so
// hard-deleting a person also removes the satellite row. Soft delete (the
// API path) just sets person.deleted_at and leaves this row untouched.

export const naturalPerson = pgTable(
  "natural_person",
  {
    personId: uuid("person_id")
      .primaryKey()
      .references(() => person.id, { onDelete: "cascade" }),

    firstName: text("first_name"),
    lastName: text("last_name"),
    nickname: text("nickname"),

    // CNP — Romanian Personal Numeric Code. Optional (foreign nationals
    // may not have one). UNIQUE when present (partial unique index below).
    // Once set, cannot be changed — enforced by a trigger added in the
    // migration (NULL → value is allowed; value → anything-different is not).
    cnp: text("cnp"),

    idDocumentType: idDocumentTypeEnum("id_document_type"),
    idDocumentNumber: text("id_document_number"),

    gender: genderEnum("gender"),
    dateOfBirth: date("date_of_birth"),

    personalPhone1: text("personal_phone_1"),
    personalPhone2: text("personal_phone_2"),
    workPhone: text("work_phone"),
    personalEmail1: text("personal_email_1"),
    personalEmail2: text("personal_email_2"),
    workEmail: text("work_email"),
  },
  (t) => [
    // At least one of first_name / last_name must be set.
    check(
      "natural_person_has_name",
      sql`${t.firstName} IS NOT NULL OR ${t.lastName} IS NOT NULL`,
    ),
    // ID document type and number are paired — both set or both null.
    check(
      "natural_person_id_doc_paired",
      sql`(${t.idDocumentType} IS NULL) = (${t.idDocumentNumber} IS NULL)`,
    ),
    // At least one contact method (any phone or email) must be set.
    check(
      "natural_person_has_contact",
      sql`coalesce(${t.personalPhone1}, ${t.personalPhone2}, ${t.workPhone}, ${t.personalEmail1}, ${t.personalEmail2}, ${t.workEmail}) IS NOT NULL`,
    ),
    // CNP is unique when present (partial unique index).
    uniqueIndex("natural_person_cnp_unique")
      .on(t.cnp)
      .where(sql`${t.cnp} IS NOT NULL`),
  ],
);

// ---------------------------------------------------------------------------
// address — owned by a person, one row per (person, kind)
// ---------------------------------------------------------------------------
//
// FK cascades on hard-delete of person. When a user clears an address block
// in the form, we hard-delete the row directly (no deleted_at on address —
// addresses are part of the person's aggregate, not separately archived).

export const address = pgTable(
  "address",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    personId: uuid("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),

    kind: addressKindEnum("kind").notNull(),

    // "Street, No., Block, Floor, Apt" — single free-form field per spec.
    streetLine: text("street_line"),
    postalCode: text("postal_code"),
    // "City, Locality, UAT, Commune, Village" — single free-form field.
    locality: text("locality"),
    // "County / Sector" — free text for now; will become FK later.
    county: text("county"),
    country: text("country").notNull(),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // A person can have at most one address of each kind.
    uniqueIndex("address_person_kind_unique").on(t.personId, t.kind),
  ],
);
