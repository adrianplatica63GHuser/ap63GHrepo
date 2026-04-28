/**
 * Zod input schemas for the Property API.
 *
 * Base shapes are derived from Drizzle table definitions via drizzle-zod,
 * then refined for domain rules. `surfaceAreaMp` is overridden to accept a
 * number from JSON (drizzle-zod emits z.string() for numeric columns).
 */

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { property } from "@/db/schema";

// ---------------------------------------------------------------------------
// Corner input
// ---------------------------------------------------------------------------

export const cornerInputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type CornerInput = z.infer<typeof cornerInputSchema>;

// ---------------------------------------------------------------------------
// Address input
// ---------------------------------------------------------------------------

export const propertyAddressInputSchema = z.object({
  streetLine: z.string().nullish(),
  postalCode: z.string().nullish(),
  locality:   z.string().nullish(),
  county:     z.string().nullish(),
  country:    z.string().min(1, "country is required"),
  notes:      z.string().nullish(),
});
export type PropertyAddressInput = z.infer<typeof propertyAddressInputSchema>;

// ---------------------------------------------------------------------------
// Property base — derived from Drizzle, server-managed fields omitted
// ---------------------------------------------------------------------------

const propertyBase = createInsertSchema(property)
  .omit({
    id:        true,
    code:      true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    // type is always LAND for now; not user-settable via the API
    type: true,
  })
  .extend({
    // Override: drizzle-zod emits z.string() for numeric; we accept number from JSON.
    surfaceAreaMp: z.coerce.number().positive().nullish(),
  });

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export const propertyCreateSchema = propertyBase.extend({
  // null / omitted = no address
  address: propertyAddressInputSchema.nullish(),
  // [] = no corners (valid — corners can be added later)
  corners: z.array(cornerInputSchema).default([]),
});
export type PropertyCreate = z.infer<typeof propertyCreateSchema>;

// ---------------------------------------------------------------------------
// Update — all fields optional
//
// Corners / address absence semantics:
//   omitted   → leave existing data untouched
//   []        → delete all corners (or delete address when address: null)
//   non-empty → replace all corners (or replace address)
// ---------------------------------------------------------------------------

export const propertyUpdateSchema = propertyBase.partial().extend({
  address: propertyAddressInputSchema.nullish(),
  corners: z.array(cornerInputSchema).optional(),
});
export type PropertyUpdate = z.infer<typeof propertyUpdateSchema>;

// ---------------------------------------------------------------------------
// List query
// ---------------------------------------------------------------------------

export const propertyListQuerySchema = z.object({
  q:      z.string().optional(),
  limit:  z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PropertyListQuery = z.infer<typeof propertyListQuerySchema>;
