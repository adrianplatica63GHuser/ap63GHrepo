/**
 * Zod input schemas for the Paperwork API.
 *
 * All 19 document types share a single base schema.
 * `paperworkCreateSchema` / `paperworkUpdateSchema` are used by the API.
 * `PAPERWORK_TYPES` is the authoritative ordered list used in both the
 * form select and the i18n label maps.
 */

import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Type enum — mirrors paperworkTypeEnum in the DB schema
// ---------------------------------------------------------------------------

export const PAPERWORK_TYPES = [
  "ACT_ADJUDECARE",
  "ACT_CADASTRU",
  "ACT_DONATIE",
  "AUTORIZATIE",
  "AVIZ_INSTITUTIE",
  "CARTE_IDENTITATE",
  "CERTIFICAT_FISCAL",
  "CERTIFICAT_MOSTENITOR",
  "CERTIFICAT_SARCINI",
  "CERTIFICAT_URBANISM",
  "CONTRACT_ARENDA",
  "CONTRACT_INCHIRIERE",
  "CONTRACT_PARTAJ",
  "CONTRACT_PRESTARI_SERVICII",
  "CONTRACT_VANZARE",
  "EXTRAS_CARTE_FUNCIARA",
  "EXTRAS_PUG",
  "HOTARARE_JUDECATOREASCA",
  "TESTAMENT",
  "TITLU_PROPRIETATE",
  "UNCLASSIFIED",
] as const;

export type PaperworkType = (typeof PAPERWORK_TYPES)[number];

// ---------------------------------------------------------------------------
// Types that have specific field sections in the form
// ---------------------------------------------------------------------------

/** Types with Titular + Defunct fields (Titlu de Proprietate layout) */
export const TYPES_WITH_TITULAR: ReadonlySet<PaperworkType> = new Set([
  "TITLU_PROPRIETATE",
]);

/** Types with Defunct / Mostenitori fields (Certificat de Mostenitor layout) */
export const TYPES_WITH_MOSTENITOR: ReadonlySet<PaperworkType> = new Set([
  "CERTIFICAT_MOSTENITOR",
]);

/** Types that carry a Suprafata field */
export const TYPES_WITH_SUPRAFATA: ReadonlySet<PaperworkType> = new Set([
  "TITLU_PROPRIETATE",
]);

/** Types where parties_a = Vanzatori, parties_b = Cumparatori */
export const TYPES_WITH_VANZARE: ReadonlySet<PaperworkType> = new Set([
  "CONTRACT_VANZARE",
]);

/** Types where parties_a = Donatori, parties_b = Donatari */
export const TYPES_WITH_DONATIE: ReadonlySet<PaperworkType> = new Set([
  "ACT_DONATIE",
]);

/** Types with Testator (uses defunctText column) */
export const TYPES_WITH_TESTAMENT: ReadonlySet<PaperworkType> = new Set([
  "TESTAMENT",
]);

/** Types where parties_a = Proprietari, parties_b = Chiriasi */
export const TYPES_WITH_INCHIRIERE: ReadonlySet<PaperworkType> = new Set([
  "CONTRACT_INCHIRIERE",
  "CONTRACT_ARENDA",
]);

/** Types that show a date range (dateStart / dateEnd) */
export const TYPES_WITH_DATE_RANGE: ReadonlySet<PaperworkType> = new Set([
  "CONTRACT_INCHIRIERE",
  "CONTRACT_ARENDA",
]);

/** Types with emitent + baza_legala fields */
export const TYPES_WITH_EMITENT: ReadonlySet<PaperworkType> = new Set([
  "TITLU_PROPRIETATE",
]);

/** Types with UAT fields */
export const TYPES_WITH_UAT: ReadonlySet<PaperworkType> = new Set([
  "TITLU_PROPRIETATE",
]);

// ---------------------------------------------------------------------------
// Base schema — all nullable except `type`
// ---------------------------------------------------------------------------

const paperworkBase = z.object({
  type:         z.enum(PAPERWORK_TYPES),
  title:        z.string().nullish(),

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

export const paperworkCreateSchema = paperworkBase;
export type PaperworkCreate = z.infer<typeof paperworkCreateSchema>;

// ---------------------------------------------------------------------------
// Update schema — all fields optional (partial patch)
// ---------------------------------------------------------------------------

export const paperworkUpdateSchema = paperworkBase.partial();
export type PaperworkUpdate = z.infer<typeof paperworkUpdateSchema>;

// ---------------------------------------------------------------------------
// List query schema
// ---------------------------------------------------------------------------

export const paperworkListQuerySchema = z.object({
  q:      z.string().optional(),
  // Multi-type filter — array of valid type keys.
  // undefined  → no filter (show all)
  // []         → nothing selected (caller should avoid this; API returns empty)
  // [...]      → filter to those types
  types:  z.array(z.enum(PAPERWORK_TYPES)).optional(),
  limit:  z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PaperworkListQuery = z.infer<typeof paperworkListQuerySchema>;
