/**
 * Zod input schemas for the Document API.
 *
 * Document types are no longer a hardcoded enum (Slice #15.05) — they are
 * rows in `lookup_document_type`, managed via Administration → Reference
 * Data. `documentTypeId` is a plain uuid FK. Per standing rule: new type
 * values are added by Adrian (or by Claude only when explicitly directed) —
 * never auto-seeded by application code or migrations going forward.
 */

import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Base schema — all nullable except `documentTypeId`
// ---------------------------------------------------------------------------

const documentBase = z.object({
  documentTypeId: z.string().uuid(),
  title:          z.string().nullish(),

  // Common (label varies by type)
  nrDocument:    z.string().nullish(),
  dateDocument:  z.string().nullish(), // ISO date string "YYYY-MM-DD"
  // Slice #18.16.VL: was free-text `institution`; now FK to lookup_institution.
  institutionId: z.string().uuid().nullish(),

  // Titlu de Proprietate specific
  emitent:        z.string().nullish(),
  bazaLegala:     z.string().nullish(),
  uatProprietate: z.string().nullish(),
  uatProprietar:  z.string().nullish(),
  suprafata:      z.coerce.number().positive().nullish(),

  // Certificat de Moștenitor specific
  nrDosarSuccesoral: z.string().nullish(),
  dataDecesului:     z.string().nullish(), // ISO date string
  ultimulDomiciliu:  z.string().nullish(),
  nrCertificatDeces: z.string().nullish(),

  // Contract de Închiriere specific
  dateStart: z.string().nullish(), // ISO date string
  dateEnd:   z.string().nullish(), // ISO date string

  // Always present
  notes: z.string().nullish(),

  // Slice #19.03: type-specific fields
  subject:        z.string().nullish(),
  dateValidUntil: z.string().nullish(), // ISO date string "YYYY-MM-DD"
  surveyorId:     z.string().uuid().nullish(),
});

// ---------------------------------------------------------------------------
// Create schema
// ---------------------------------------------------------------------------

export const documentCreateSchema = documentBase;
export type DocumentCreate = z.infer<typeof documentCreateSchema>;

// ---------------------------------------------------------------------------
// Update schema — all fields optional (partial patch)
// ---------------------------------------------------------------------------

// Slice #21.02.Import: aiInterpretedAt can be patched directly; it is NOT
// included in documentBase (not a versioned form field) so it is attached here
// as an extension. updateDocument reads it from the patch but omits it from
// the version snapshot.
export const documentUpdateSchema = documentBase.partial().extend({
  aiInterpretedAt: z.string().nullish(),
});
export type DocumentUpdate = z.infer<typeof documentUpdateSchema>;

// ---------------------------------------------------------------------------
// List query schema
// ---------------------------------------------------------------------------

export const documentListQuerySchema = z.object({
  q: z.string().optional(),
  // Multi-type filter — array of lookup_document_type uuids.
  // undefined  → no filter (show all)
  // []         → nothing selected (caller should avoid this; API returns empty)
  // [...]      → filter to those types
  documentTypeIds: z.array(z.string().uuid()).optional(),
  limit:  z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  // Slice #18.17: Groups filter. See GroupsFilter in groups-filter-dropdown.tsx.
  //   groupCodes undefined   → no group filter (show all — default)
  //   groupCodes []          → show only documents with NO DOCUMENT group
  //   groupCodes [...]       → filter to those codes (+ ungrouped unless includeUngrouped=false)
  //   includeUngrouped false → exclude documents with no group
  //   includeUngrouped true  → include documents with no group (default)
  groupCodes:       z.array(z.string()).optional(),
  includeUngrouped: z.boolean().optional(),
  // Slice #20.06: Metadata filters.
  //   undefined → no filter (show all)
  importance: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  relevance:  z.enum(["INACTIVE", "HISTORICAL", "CURRENT", "FUTURE"]).optional(),
  // Slice #20.06: Expiring-soon shortcut — true → only documents where
  // date_valid_until IS NOT NULL AND date_valid_until <= today + 30 days.
  expiringSoon: z.coerce.boolean().optional(),
});
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;

// ---------------------------------------------------------------------------
// Document version snapshot (Slice #18.06)
//
// A complete snapshot of a document at one saved version. Shared between the
// server write/read path (src/lib/documents/queries.ts) and the client diff
// helpers (src/app/documents/_components/form-schema.ts). The JSON shape here
// matches migration_031's backfill exactly — keep all three in lockstep.
//
// A flat object of the document's 20 editable fields; all values string|null
// (the form's blanked-empty convention) so two snapshots diff field-by-field
// uniformly. `suprafata` is the numeric column read as a string (drizzle).
// NOT included: the M:M associations and the uploaded document_page files —
// those are separate lifecycles, out of the versioned scope.
// ---------------------------------------------------------------------------

export type DocumentSnapshot = {
  documentTypeId:    string | null;
  title:             string | null;
  nrDocument:        string | null;
  dateDocument:      string | null;
  // Slice #18.16.VL: was `institution: string | null` (free text);
  // now stores the lookup_institution UUID (or null when unset).
  institutionId:     string | null;
  emitent:           string | null;
  bazaLegala:        string | null;
  uatProprietate:    string | null;
  uatProprietar:     string | null;
  suprafata:         string | null;
  nrDosarSuccesoral: string | null;
  dataDecesului:     string | null;
  ultimulDomiciliu:  string | null;
  nrCertificatDeces: string | null;
  dateStart:         string | null;
  dateEnd:           string | null;
  notes:             string | null;
  // Slice #19.03
  subject:           string | null;
  dateValidUntil:    string | null;
  surveyorId:        string | null;
};
