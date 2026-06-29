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
  originalIndex: z.number().int().nullish(),
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
  // Slice #18.12: Street View-derived street line; shares the other fields.
  streetViewStreetLine: z.string().nullish(),
});
export type PropertyAddressInput = z.infer<typeof propertyAddressInputSchema>;

// ---------------------------------------------------------------------------
// Property base — derived from Drizzle, server-managed fields omitted
// ---------------------------------------------------------------------------

const propertyBase = createInsertSchema(property)
  .omit({
    id:                true,
    code:              true,
    principalObjectId: true,   // server-managed; set by createProperty
    createdAt:         true,
    updatedAt:         true,
    deletedAt:         true,
  })
  .extend({
    // Override: drizzle-zod emits z.string() for numeric; we accept number from JSON.
    surfaceAreaMp: z.coerce.number().positive().nullish(),
    // Slice #15.16: FK ids to lookup_property_type / lookup_use_category.
    // Empty selection -> null. Must be a uuid when present.
    propertyTypeId: z.string().uuid().nullish(),
    useCategoryId:  z.string().uuid().nullish(),
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
// Property version snapshot (Slice #18.02)
//
// A complete snapshot of a property at one saved version. Shared between the
// server write/read path (src/lib/properties/queries.ts) and the client diff
// helpers (src/app/properties/_components/form-schema.ts). The JSON shape here
// matches migration_029's backfill exactly — keep all three in lockstep.
// ---------------------------------------------------------------------------

export type PropertySnapshotProperty = {
  propertyTypeId:  string | null;
  nickname:        string | null;
  tarlaSola:       string | null;
  parcela:         string | null;
  cadastralNumber: string | null;
  carteFunciara:   string | null;
  useCategoryId:   string | null;
  surfaceAreaMp:   string | null;
  // Slice #18.09: system-computed area (m²) from the corners. Stored in the
  // snapshot for completeness; it is NOT a separately-highlighted field (it
  // only changes when corners change, which are already diffed).
  calculatedAreaMp: string | null;
  notes:           string | null;
};

export type PropertySnapshotAddress = {
  streetLine: string | null;
  postalCode: string | null;
  locality:   string | null;
  county:     string | null;
  country:    string;
  notes:      string | null;
  // Slice #18.12: Street View-derived street line (see migration_034).
  streetViewStreetLine: string | null;
};

export type PropertySnapshotCorner = {
  lat:           number;
  lon:           number;
  originalIndex: number | null;
};

export type PropertySnapshot = {
  property: PropertySnapshotProperty;
  address:  PropertySnapshotAddress | null;
  corners:  PropertySnapshotCorner[];
};

// ---------------------------------------------------------------------------
// List query
// ---------------------------------------------------------------------------

export const propertyListQuerySchema = z.object({
  q:      z.string().optional(),
  limit:  z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PropertyListQuery = z.infer<typeof propertyListQuerySchema>;
