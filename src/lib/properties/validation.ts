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
  })
  .extend({
    // Override: drizzle-zod emits z.string() for numeric; we accept number from JSON.
    surfaceAreaMp: z.coerce.number().positive().nullish(),
    // Slice #15.16: FK ids to lookup_property_type / lookup_use_category.
    // Empty selection -> null. Must be a uuid when present.
    propertyTypeId: z.string().uuid().nullish(),
    useCategoryId:  z.string().uuid().nullish(),
    // Slice #34.03: `tarla_sola` was free text until migration_078; it is now
    // an FK to lookup_tarla and belongs with the two above.
    tarlaId:        z.string().uuid().nullish(),
  });

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export const propertyCreateSchema = propertyBase.extend({
  /**
   * A tarla CODE to resolve or create, as opposed to `tarlaId`, which is a row
   * somebody already picked.                                    (Slice #34.03)
   *
   * ⚠️ **TWO FIELDS FOR ONE COLUMN, AND THE SPLIT IS THE POINT.** This create
   * path has two kinds of client and they arrive with different things in
   * hand:
   *
   *   a PERSON, through `property-form.tsx`, picks from a SELECT over
   *   `lookup_tarla` and therefore sends `tarlaId`. (`add-property-dialog.tsx`
   *   is the other client of this schema and has no tarla field at all — it
   *   builds its payload key by key and sends neither. A review round caught
   *   this paragraph naming it as a sender.);
   *
   *   an IMPORT — `/api/documents/[id]/process` and `ensurePropertyForFolder`
   *   — has a string a machine parsed out of a FOLDER NAME, which may not be
   *   a row yet, and therefore sends `tarlaCode`.
   *
   * Before #34.03 both went down one free-text field, which is why the
   * auto-seed had to guess who it was talking to and why migration_077's
   * header spends four paragraphs arguing that only an import can reach it.
   * Naming the doors makes that argument structural: `createPropertyIn` writes
   * the IMPORT origin inside the `tarlaCode` branch and nowhere else, so a
   * client sending `tarlaId` cannot mint a row at all, and a client sending
   * `tarlaCode` cannot claim a person chose it.
   *
   * `tarlaId` wins if both are sent — an id is a decision, a code is a lookup.
   * Not accepted on UPDATE: editing goes through the select, and letting an
   * edit mint a code would put an import-origin row behind a person's click.
   */
  tarlaCode: z.string().trim().min(1).nullish(),
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

// ⚠️ No `tarlaCode` here — see the note on `propertyCreateSchema`. `.partial()`
// over `propertyBase` gives this `tarlaId`, which is what the form sends.
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
  /**
   * Slice #34.03: was `tarlaSola`, the CODE as text. Now the lookup row's id,
   * which is what `propertyTypeId` and `useCategoryId` beside it have always
   * been.
   *
   * ⚠️ **Snapshots written before migration_078 still carry `tarlaSola`, and
   * nothing rewrites them.** A version records what was true when it was
   * saved; re-encoding old ones would be a migration inventing history, and a
   * snapshot holding an id reads the CURRENT name for ever after — so the
   * first rename would silently restate every past version.
   *
   * ⚠️ **TWO VISIBLE CONSEQUENCES, AND A REVIEW ROUND FOUND THE SECOND ONE
   * AFTER AN EARLIER VERSION OF THIS NOTE CALLED IT "bounded":**
   *
   *   1. A property that HAD a tarla writes one version on its next save whose
   *      diff shows this field changing. Once per property, and honest — what
   *      it stores really did change. (A property that never had one writes
   *      nothing extra: `snapshotsEqual` compares `?? null`, so an absent key
   *      and an explicit null are the same fact. That was the half this note
   *      originally described, and it was the half that was wrong.)
   *
   *   2. **Every version saved before this slice rendered its tarla box EMPTY,
   *      permanently — until Slice #34.17.** `fromApiPayload` reads `tarlaId`;
   *      the old text is still in the jsonb and there is no id to resolve it
   *      to. It was the same shape as the gap `async-select.tsx`'s docblock
   *      recorded — a snapshot holds lookup ids with no FK, so a deleted lookup
   *      row left an old version showing an empty box too — and #34.17 answered
   *      both: `src/lib/versioning/snapshot-lookup.ts` classifies what the
   *      snapshot holds, and the property version view prints the row's label,
   *      the snapshot's own recorded text, or „valoare ștearsă". The jsonb is
   *      still not rewritten, and this note is still the reason why.
   *
   *      What #34.17 did NOT close, because it cannot be closed without
   *      rewriting snapshots: the DIFF is still blind to `tarlaSola` — it is
   *      in neither `PROPERTY_SNAPSHOT_PROPERTY_KEYS` nor the nine-key
   *      `PROPERTY_SNAP_KEYS` that `computeFieldHighlights` actually walks — so
   *      two pre-078 versions
   *      whose tarla text differs now show two different values with no frame
   *      between them, and the boundary pair in point 1 is framed green
   *      ("added") over a predecessor that visibly shows a tarla.
   */
  tarlaId:         string | null;
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
  // Slice #18.17: Groups filter. See GroupsFilter in groups-filter-dropdown.tsx.
  //   groupCodes undefined   → no group filter (show all — default)
  //   groupCodes []          → show only properties with NO PROPERTY group
  //   groupCodes [...]       → filter to those codes (+ ungrouped unless includeUngrouped=false)
  //   includeUngrouped false → exclude properties with no group (only when groupCodes present)
  //   includeUngrouped true  → include properties with no group (default)
  groupCodes:       z.array(z.string()).optional(),
  includeUngrouped: z.boolean().optional(),
  // Slice #20.06: Metadata filters.
  //   undefined → no filter (show all)
  //   "LOW"|"MEDIUM"|"HIGH" → filter to that importance value
  importance: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  //   "INACTIVE"|"HISTORICAL"|"CURRENT"|"FUTURE" → filter to that relevance value
  relevance:  z.enum(["INACTIVE", "HISTORICAL", "CURRENT", "FUTURE"]).optional(),
});
export type PropertyListQuery = z.infer<typeof propertyListQuerySchema>;
