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
  })
  // ID document type and number are paired — both set or both empty.
  .refine(
    (d) => (d.idDocumentType == null) === (d.idDocumentNumber == null),
    {
      message:
        "ID document type and number must be both set or both empty",
      path: ["idDocumentType"],
    },
  )
  // At least one phone or email must be provided.
  .refine(
    (d) =>
      Boolean(
        d.personalPhone1 ??
          d.personalPhone2 ??
          d.workPhone ??
          d.personalEmail1 ??
          d.personalEmail2 ??
          d.workEmail,
      ),
    {
      message: "At least one phone or email must be provided",
      path: ["personalPhone1"],
    },
  );

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
