/**
 * Zod input schemas for the Judicial Person API.
 *
 * Mirrors the natural-person validation module. Schemas are derived from
 * the Drizzle table definition via drizzle-zod, then refined with our
 * domain-level rules (defense in depth on top of the DB CHECK constraints).
 *
 * The `notes` field on the create/update payload lives on the `person`
 * (base) table, NOT on `judicial_person`. The handlers split it accordingly.
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
  });

export type JudicialPersonUpdate = z.infer<typeof judicialPersonUpdateSchema>;

// ---------------------------------------------------------------------------
// List query — search + pagination
// ---------------------------------------------------------------------------

export const judicialListQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type JudicialListQuery = z.infer<typeof judicialListQuerySchema>;
