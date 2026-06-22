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
  nrDocument:   z.string().nullish(),
  dateDocument: z.string().nullish(), // ISO date string "YYYY-MM-DD"
  institution:  z.string().nullish(),

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

  // Party placeholders (→ Slice 5 Person relationships)
  titularText:  z.string().nullish(),
  defunctText:  z.string().nullish(),
  partiesAText: z.string().nullish(),
  partiesBText: z.string().nullish(),

  // Always present
  notes: z.string().nullish(),
});

// ---------------------------------------------------------------------------
// Create schema
// ---------------------------------------------------------------------------

export const documentCreateSchema = documentBase;
export type DocumentCreate = z.infer<typeof documentCreateSchema>;

// ---------------------------------------------------------------------------
// Update schema — all fields optional (partial patch)
// ---------------------------------------------------------------------------

export const documentUpdateSchema = documentBase.partial();
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
});
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;
