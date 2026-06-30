/**
 * Zod input schemas for the Person API.
 *
 * Schemas are derived from the Drizzle table definitions via drizzle-zod,
 * then refined with our domain-level rules (the same rules enforced by
 * DB CHECK constraints — defense in depth).
 *
 * The `notes` field on the create/update payload lives on the `person`
 * (base) table, NOT on `natural_person`. The handlers split it accordingly.
 */

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { naturalPerson } from "@/db/schema";

// ---------------------------------------------------------------------------
// Address input — used in both create and update payloads
// ---------------------------------------------------------------------------

export const addressInputSchema = z.object({
  kind: z.enum(["HOME", "POSTAL", "HEADQUARTERS", "CORRESPONDENCE"]),
  streetLine: z.string().nullish(),
  postalCode: z.string().nullish(),
  locality: z.string().nullish(),
  county: z.string().nullish(),
  country: z.string().min(1, "country is required"),
  notes: z.string().nullish(),
});

export type AddressInput = z.infer<typeof addressInputSchema>;

const addressArraySchema = z
  .array(addressInputSchema)
  .refine(
    (arr) => new Set(arr.map((a) => a.kind)).size === arr.length,
    { message: "Address kinds must be unique within a single payload" },
  );

// ---------------------------------------------------------------------------
// Natural person — base shape derived from the Drizzle table
// ---------------------------------------------------------------------------

const naturalPersonBase = createInsertSchema(naturalPerson).omit({
  // Populated by the handler after inserting the parent person row.
  personId: true,
});

// ---------------------------------------------------------------------------
// Create payload — full shape, with refinements that mirror DB CHECK rules
// ---------------------------------------------------------------------------

export const naturalPersonCreateSchema = naturalPersonBase
  .extend({
    // `notes` belongs on the `person` table (the aggregate root), not on
    // the natural_person satellite. The handler routes it accordingly.
    notes: z.string().nullish(),
    addresses: addressArraySchema.default([]),
  })
  // At least one of firstName / lastName must be provided.
  .refine((d) => Boolean(d.firstName) || Boolean(d.lastName), {
    message: "At least one of firstName or lastName must be provided",
    path: ["firstName"],
  });

export type NaturalPersonCreate = z.infer<typeof naturalPersonCreateSchema>;

// ---------------------------------------------------------------------------
// Update payload — every field optional; addresses optional (omit = don't
// touch). DB CHECK constraints enforce post-state rules; we don't re-run
// the create-time refinements here because we'd need the merged state.
// ---------------------------------------------------------------------------

export const naturalPersonUpdateSchema = naturalPersonBase
  .partial()
  .extend({
    notes: z.string().nullish(),
    // Omitted = leave addresses untouched.
    // [] = clear all addresses.
    // Non-empty = merge by kind (delete existing, insert new).
    addresses: addressArraySchema.optional(),
  });

export type NaturalPersonUpdate = z.infer<typeof naturalPersonUpdateSchema>;

// ---------------------------------------------------------------------------
// List query — search + pagination
// ---------------------------------------------------------------------------

export const listQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

// ---------------------------------------------------------------------------
// Combined list query — Natural + Judicial (Slice #15.09: unified /persons
// page). `types` mirrors the Documents `documentTypeIds` semantics:
//   undefined → no filter param in the URL → show both types
//   []        → filter param present but empty → show nothing
//   [...]     → filter to just the given types
// ---------------------------------------------------------------------------

export const allPersonsListQuerySchema = z.object({
  q: z.string().optional(),
  types: z.array(z.enum(["NATURAL", "JUDICIAL"])).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type AllPersonsListQuery = z.infer<typeof allPersonsListQuerySchema>;

// ---------------------------------------------------------------------------
// Person version snapshot (Slice #18.05)
//
// A complete snapshot of a (natural) person at one saved version. Shared
// between the server write/read path (src/lib/persons/queries.ts) and the
// client diff helpers (src/app/natural-persons/_components/form-schema.ts).
// The JSON shape here matches migration_030's NATURAL backfill exactly — keep
// all three in lockstep. All values are string|null (the form's blanked-empty
// convention) so two snapshots can be diffed field-by-field uniformly.
//
// `PersonAddressSnapshot` is reused by the judicial snapshot too (see
// src/lib/judicial-persons/validation.ts).
// ---------------------------------------------------------------------------

export type PersonAddressSnapshot = {
  streetLine: string | null;
  postalCode: string | null;
  locality:   string | null;
  county:     string | null;
  country:    string | null;
  notes:      string | null;
};

export type NaturalPersonSnapshotFields = {
  firstName:          string | null;
  lastName:           string | null;
  nickname:           string | null;
  cnp:                string | null;
  idDocumentType:     string | null;
  idDocumentNumber:   string | null;
  gender:             string | null;
  dateOfBirth:        string | null;
  personalPhone1:     string | null;
  personalPhone2:     string | null;
  workPhone:          string | null;
  personalEmail1:     string | null;
  personalEmail2:     string | null;
  workEmail:          string | null;
  placeOfBirth:       string | null;
  idIssuingAuthority: string | null;
  idValidFrom:        string | null;
  idValidUntil:       string | null;
  idCardNumber:           string | null;
  idMrzRaw:               string | null;
  citizenshipId:          string | null;
  // Slice #18.16.VL: Professional Type FK (lookup_person_type).
  physicalPersonTypeId:   string | null;
};

export type NaturalPersonSnapshot = {
  // person.notes (lives on the base `person` row, not natural_person).
  notes:   string | null;
  natural: NaturalPersonSnapshotFields;
  addresses: {
    HOME:           PersonAddressSnapshot | null;
    CORRESPONDENCE: PersonAddressSnapshot | null;
  };
};
