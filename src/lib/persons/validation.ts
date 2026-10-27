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
import { LEGACY_PERSON_ID_CARD_KEYS, type LegacyPersonIdCardKey, type LegacyPersonIdCardSnapshot } from "./legacy-id-card";

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

/**
 * Slice #39.70 — „Relația cu firma": the ids of the relationships the person holds, written to
 * natural_person_relationship beside the person and never part of a version's snapshot (as a person's tags are not).
 */
const relationshipIdsSchema = z.array(z.string().uuid()).max(50).optional();

// Slice 40.85: the identity-card keys a version written before 40.85 still holds (./legacy-id-card); the columns
// themselves were dropped by migration_119.
export { LEGACY_PERSON_ID_CARD_KEYS, type LegacyPersonIdCardKey, type LegacyPersonIdCardSnapshot };

const naturalPersonBase = createInsertSchema(naturalPerson).omit({
  // Populated by the handler after inserting the parent person row.
  personId: true,
  // The identity-card columns are gone (migration_119): a payload naming one is answered as if it did not, since an
  // object schema strips the keys it does not know.
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
    relationshipIds: relationshipIdsSchema,
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
    // Slice #39.70: omitted = leave „Relația cu firma" untouched; [] = clear it.
    relationshipIds: relationshipIdsSchema,
  });

export type NaturalPersonUpdate = z.infer<typeof naturalPersonUpdateSchema>;

// ---------------------------------------------------------------------------
// List query — search + pagination
// ---------------------------------------------------------------------------

export const listQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  // Slice #18.18: Groups filter for the /natural-persons list page.
  //   groupCodes undefined   → no group filter (show all — default)
  //   groupCodes []          → show only persons with NO matching group
  //   groupCodes [...]       → filter to those codes (+ ungrouped unless includeUngrouped=false)
  //   includeUngrouped false → exclude persons with no matching group
  groupCodes:       z.array(z.string()).optional(),
  includeUngrouped: z.boolean().optional(),
  // Slice #20.06: Metadata filters.
  //   undefined → no filter (show all)
  //   "LOW"|"MEDIUM"|"HIGH" → filter to that importance value
  importance: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  //   "INACTIVE"|"HISTORICAL"|"CURRENT"|"FUTURE" → filter to that relevance value
  relevance:  z.enum(["INACTIVE", "HISTORICAL", "CURRENT", "FUTURE"]).optional(),
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
  // Slice #18.17: Groups filter. See GroupsFilter in groups-filter-dropdown.tsx.
  //   groupCodes undefined   → no group filter (show all — default)
  //   groupCodes []          → show only persons with NO matching group
  //   groupCodes [...]       → filter to those codes (+ ungrouped unless includeUngrouped=false)
  //   includeUngrouped false → exclude persons with no matching group
  //   includeUngrouped true  → include persons with no matching group (default)
  groupCodes:       z.array(z.string()).optional(),
  includeUngrouped: z.boolean().optional(),
  // Slice #20.06: Metadata filters (same semantics as listQuerySchema above).
  importance: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  relevance:  z.enum(["INACTIVE", "HISTORICAL", "CURRENT", "FUTURE"]).optional(),
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
  gender:             string | null;
  dateOfBirth:        string | null;
  // Slice #39.30 (migration_108 backfilled both into every older snapshot):
  isDeceased:         boolean;
  dateOfDeath:        string | null;
  personalPhone1:     string | null;
  personalPhone2:     string | null;
  workPhone:          string | null;
  personalEmail1:     string | null;
  personalEmail2:     string | null;
  workEmail:          string | null;
  placeOfBirth:       string | null;
  citizenshipId:          string | null;
  // Slice #18.16.VL: Professional Type FK (lookup_person_type).
  physicalPersonTypeId:   string | null;
  // Slice #19.01: mirrors correspondenceSameAsHq on judicial_person.
  correspondenceSameAsHome: boolean;
};

export type NaturalPersonSnapshot = {
  // person.notes (lives on the base `person` row, not natural_person).
  notes:   string | null;
  natural: NaturalPersonSnapshotFields & LegacyPersonIdCardSnapshot;
  addresses: {
    HOME:           PersonAddressSnapshot | null;
    CORRESPONDENCE: PersonAddressSnapshot | null;
  };
};
