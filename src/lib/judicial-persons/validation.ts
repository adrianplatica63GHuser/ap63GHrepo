/**
 * Zod input schemas for the Judicial Person API.
 *
 * Mirrors the natural-person validation module. Schemas are derived from
 * the Drizzle table definition via drizzle-zod, then refined with our
 * domain-level rules (defense in depth on top of the DB CHECK constraints).
 *
 * The `notes` field on the create/update payload lives on the `person`
 * (base) table, NOT on `judicial_person`. The handlers split it accordingly.
 *
 * contactPerson1Id / contactPerson2Id are nullable UUIDs referencing
 * person.id (natural persons only — enforced at the UI layer).
 *
 * correspondenceSameAsHq — when true the UI hides the CORRESPONDENCE address
 * block and no CORRESPONDENCE address row is stored.
 */

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { judicialPerson } from "@/db/schema";

// ---------------------------------------------------------------------------
// Address input — judicial persons only have HEADQUARTERS + CORRESPONDENCE
// ---------------------------------------------------------------------------

export const judicialAddressInputSchema = z.object({
  kind: z.enum(["HEADQUARTERS", "CORRESPONDENCE"]),
  streetLine: z.string().nullish(),
  postalCode: z.string().nullish(),
  locality: z.string().nullish(),
  county: z.string().nullish(),
  country: z.string().min(1, "country is required"),
  notes: z.string().nullish(),
});

export type JudicialAddressInput = z.infer<typeof judicialAddressInputSchema>;

const addressArraySchema = z
  .array(judicialAddressInputSchema)
  .refine(
    (arr) => new Set(arr.map((a) => a.kind)).size === arr.length,
    { message: "Address kinds must be unique within a single payload" },
  );

// ---------------------------------------------------------------------------
// Judicial person — base shape derived from the Drizzle table
// ---------------------------------------------------------------------------

const judicialPersonBase = createInsertSchema(judicialPerson).omit({
  // Populated by the handler after inserting the parent person row.
  personId: true,
});

// ---------------------------------------------------------------------------
// Create payload — full shape (only `name` is required by the schema)
// ---------------------------------------------------------------------------

export const judicialPersonCreateSchema = judicialPersonBase.extend({
  // `notes` belongs on the `person` table (the aggregate root), not on
  // the judicial_person satellite. The handler routes it accordingly.
  notes: z.string().nullish(),
  addresses: addressArraySchema.default([]),
  // Contact person FK IDs (natural persons only; validated at UI layer).
  contactPerson1Id: z.string().uuid().nullish(),
  contactPerson2Id: z.string().uuid().nullish(),
  // Judicial person type FK (Slice #15.07) -> lookup_judicial_person_type.id.
  // Optional; admin-managed via Administration -> Reference Data.
  judicialPersonTypeId: z.string().uuid().nullish(),
  // When true, no CORRESPONDENCE address row is stored.
  correspondenceSameAsHq: z.boolean().default(false),
});

export type JudicialPersonCreate = z.infer<typeof judicialPersonCreateSchema>;

// ---------------------------------------------------------------------------
// Update payload — every field optional; addresses optional (omit = don't
// touch). DB CHECK / trigger constraints enforce post-state rules.
// ---------------------------------------------------------------------------

export const judicialPersonUpdateSchema = judicialPersonBase
  .partial()
  .extend({
    notes: z.string().nullish(),
    // Omitted = leave addresses untouched.
    // [] = clear all addresses.
    // Non-empty = merge by kind (delete existing, insert new).
    addresses: addressArraySchema.optional(),
    contactPerson1Id: z.string().uuid().nullish(),
    contactPerson2Id: z.string().uuid().nullish(),
    judicialPersonTypeId: z.string().uuid().nullish(),
    correspondenceSameAsHq: z.boolean().optional(),
  });

export type JudicialPersonUpdate = z.infer<typeof judicialPersonUpdateSchema>;

// ---------------------------------------------------------------------------
// List query — search + pagination
// ---------------------------------------------------------------------------

export const judicialListQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  // Slice #18.18: Groups filter for the /judicial-persons list page.
  groupCodes:       z.array(z.string()).optional(),
  includeUngrouped: z.boolean().optional(),
});

export type JudicialListQuery = z.infer<typeof judicialListQuerySchema>;

// ---------------------------------------------------------------------------
// Judicial person version snapshot (Slice #18.05)
//
// A complete snapshot of a judicial person at one saved version. Shared between
// the server write/read path (src/lib/judicial-persons/queries.ts) and the
// client diff helpers (src/app/judicial-persons/_components/form-schema.ts).
// The JSON shape here matches migration_030's JUDICIAL backfill exactly — keep
// all three in lockstep. Values are string|null (blanked-empty convention)
// except correspondenceSameAsHq, which is a boolean.
//
// `PersonAddressSnapshot` is shared with the natural snapshot.
// ---------------------------------------------------------------------------

import type { PersonAddressSnapshot } from "@/lib/persons/validation";

export type JudicialPersonSnapshotFields = {
  name:                   string | null;
  nickname:               string | null;
  judicialPersonTypeId:   string | null;
  cuiNumber:              string | null;
  tradeRegisterNumber:    string | null;
  contactPerson1Id:       string | null;
  contactPerson2Id:       string | null;
  correspondenceSameAsHq: boolean;
};

export type JudicialPersonSnapshot = {
  // person.notes (lives on the base `person` row, not judicial_person).
  notes:    string | null;
  judicial: JudicialPersonSnapshotFields;
  addresses: {
    HEADQUARTERS:   PersonAddressSnapshot | null;
    CORRESPONDENCE: PersonAddressSnapshot | null;
  };
};
