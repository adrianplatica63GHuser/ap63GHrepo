import { sql } from "drizzle-orm";
import {
  check,
  date,
  doublePrecision,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// NOTE: `integer` is used below for sort_order on the lookup tables.

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
    // migration (NULL -> value is allowed; value -> anything-different is not).
    cnp: text("cnp"),

    idDocumentType: idDocumentTypeEnum("id_document_type"),
    idDocumentNumber: text("id_document_number"),

    gender: genderEnum("gender"),
    // `mode: "string"` keeps DOB as ISO date strings ("1985-02-03") on both
    // read and write — avoids the Date-object timezone gotcha for a calendar
    // date with no time component.
    dateOfBirth: date("date_of_birth", { mode: "string" }),

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

// ---------------------------------------------------------------------------
// Enums — Property domain
// ---------------------------------------------------------------------------

export const propertyTypeEnum = pgEnum("property_type", ["LAND"]);

// Placeholder values; will be replaced with real ANCPI categories later.
export const useCategoryEnum = pgEnum("use_category", [
  "CATEG1",
  "CATEG2",
  "CATEG3",
]);

// ---------------------------------------------------------------------------
// property — root entity
// ---------------------------------------------------------------------------
//
// Soft-delete via deleted_at (same pattern as person).
// Code is auto-generated from a Postgres sequence: PROP00001, PROP00002, ...
// The sequence is created in the migration (not expressible in Drizzle).

export const property = pgTable("property", {
  id: uuid("id").primaryKey().defaultRandom(),

  code: text("code")
    .notNull()
    .unique()
    .default(
      sql`'PROP' || lpad(nextval('property_code_seq')::text, 5, '0')`,
    ),

  type: propertyTypeEnum("type").notNull().default("LAND"),

  // "Porecla / elemente definitorii" — short identifying label.
  nickname: text("nickname"),

  // Romanian cadastral identifiers.
  tarlaSola:       text("tarla_sola"),       // Nr. tarla / sola
  parcela:         text("parcela"),           // Nr. parcela
  cadastralNumber: text("cadastral_number"),  // Nr. cadastru
  carteFunciara:   text("carte_funciara"),    // Nr. carte funciara

  useCategory: useCategoryEnum("use_category"),

  // "Suprafata in mp" — area in square metres.
  surfaceAreaMp: numeric("surface_area_mp", { precision: 12, scale: 2 }),

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
// property_address — single address block per property
// ---------------------------------------------------------------------------
//
// FK cascades on hard-delete of property. No `kind` column — a property has
// exactly one address. No deleted_at — clearing the address hard-deletes the
// row (same pattern as Person address).

export const propertyAddress = pgTable(
  "property_address",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),

    streetLine: text("street_line"),
    postalCode: text("postal_code"),
    locality:   text("locality"),
    county:     text("county"),
    country:    text("country").notNull(),
    notes:      text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Each property has at most one address row.
    uniqueIndex("property_address_property_unique").on(t.propertyId),
  ],
);

// ---------------------------------------------------------------------------
// property_corner — ordered polygon vertices, stored as WGS84 decimal degrees
// ---------------------------------------------------------------------------
//
// Corners are the authoritative geometry. The polygon for map display is
// derived from the ordered corner set at query time. Heights are omitted —
// we store 2-D planimetric coordinates only.

export const propertyCorner = pgTable(
  "property_corner",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),

    // 1-based display order; unique per property.
    sequenceNo: integer("sequence_no").notNull(),

    // WGS84 / ETRS89 decimal degrees.
    lat: doublePrecision("lat").notNull(),
    lon: doublePrecision("lon").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("property_corner_property_seq_unique").on(
      t.propertyId,
      t.sequenceNo,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Lookup / Reference-Data tables  (Slice #3 — Liste de Valori)
// ---------------------------------------------------------------------------
//
// These tables back the admin "Value Lists" screen. They are intentionally
// decoupled from the pg enums already in the schema (propertyTypeEnum,
// useCategoryEnum) — the enum→FK migration will happen in a later slice
// once the full domain model is settled.
//
// All tables share the same shape: uuid PK, payload fields, sort_order,
// created_at / updated_at (touched by the touch_updated_at trigger).

// ── Proprietate group ───────────────────────────────────────────────────────

export const lookupPropertyType = pgTable("lookup_property_type", {
  id:        uuid("id").primaryKey().defaultRandom(),
  name:      text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lookupTarla = pgTable("lookup_tarla", {
  id:        uuid("id").primaryKey().defaultRandom(),
  indicativ: text("indicativ").notNull(),
  descriere: text("descriere"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lookupUseCategory = pgTable("lookup_use_category", {
  id:        uuid("id").primaryKey().defaultRandom(),
  name:      text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Persoană group ──────────────────────────────────────────────────────────

export const lookupPersonType = pgTable("lookup_person_type", {
  id:        uuid("id").primaryKey().defaultRandom(),
  name:      text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lookupCitizenship = pgTable("lookup_citizenship", {
  id:        uuid("id").primaryKey().defaultRandom(),
  name:      text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Document group ──────────────────────────────────────────────────────────

export const lookupDocumentType = pgTable("lookup_document_type", {
  id:        uuid("id").primaryKey().defaultRandom(),
  name:      text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lookupInstitution = pgTable("lookup_institution", {
  id:              uuid("id").primaryKey().defaultRandom(),
  name:            text("name").notNull(),
  institutionType: text("institution_type"),
  sortOrder:       integer("sort_order").notNull().default(0),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Standalone ──────────────────────────────────────────────────────────────

export const lookupServiceInterest = pgTable("lookup_service_interest", {
  id:        uuid("id").primaryKey().defaultRandom(),
  name:      text("name").notNull(),
  category:  text("category"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
