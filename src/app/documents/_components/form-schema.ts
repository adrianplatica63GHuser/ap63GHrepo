/**
 * React Hook Form schema + helpers for the Document form.
 *
 * Keeps form state and API payload transformation in one place,
 * following the same pattern as the Property form-schema.
 *
 * NOTE (Slice #15.05): the old fixed `type` enum field was replaced by
 * `documentTypeId` — a uuid FK into the admin-managed `lookup_document_type`
 * table. The form no longer imports a static type list; the dropdown is
 * populated dynamically by the component from `GET /api/admin/value-lists/document-types`.
 *
 * NOTE (Slice #18.16.VL): `institution` (free text) replaced by `institutionId`
 * (uuid FK → lookup_institution). Dropdown populated from
 * `GET /api/admin/value-lists/institutions`.
 */

import { z } from "zod/v4";
import type { DocumentSnapshot } from "@/lib/documents/validation";
import {
  diffFieldMap,
  labelColorFromHighlights,
  normVal,
  type HighlightColor,
} from "@/lib/versioning/field-diff";

// ---------------------------------------------------------------------------
// Form schema — mirrors validation.ts but uses empty string for nullable text
// so RHF text inputs remain controlled
// ---------------------------------------------------------------------------

export const formSchema = z.object({
  documentTypeId: z.string().uuid({ message: "Select a document type" }),
  title:        z.string(),
  nrDocument:   z.string(),
  dateDocument: z.string(), // "YYYY-MM-DD" or ""
  // Slice #18.16.VL: was free-text `institution`; now uuid FK (empty string = unset).
  institutionId: z.string(),

  // Titlu de Proprietate specific
  emitent:        z.string(),
  bazaLegala:     z.string(),
  uatProprietate: z.string(),
  uatProprietar:  z.string(),
  suprafata:      z.string(), // keep as string; coerce to number in payload

  // Certificat de Moștenitor specific
  nrDosarSuccesoral: z.string(),
  dataDecesului:     z.string(), // "YYYY-MM-DD" or ""
  ultimulDomiciliu:  z.string(),
  nrCertificatDeces: z.string(),

  // Contract de Închiriere specific
  dateStart: z.string(), // "YYYY-MM-DD" or ""
  dateEnd:   z.string(), // "YYYY-MM-DD" or ""

  // Party placeholders
  titularText:  z.string(),
  defunctText:  z.string(),
  partiesAText: z.string(),
  partiesBText: z.string(),

  // Always present
  notes: z.string(),
});

export type FormValues = z.infer<typeof formSchema>;

// ---------------------------------------------------------------------------
// Empty default values
// ---------------------------------------------------------------------------

export const emptyFormValues: FormValues = {
  documentTypeId: "",
  title:        "",
  nrDocument:   "",
  dateDocument: "",
  institutionId: "",
  emitent:        "",
  bazaLegala:     "",
  uatProprietate: "",
  uatProprietar:  "",
  suprafata:      "",
  nrDosarSuccesoral: "",
  dataDecesului:     "",
  ultimulDomiciliu:  "",
  nrCertificatDeces: "",
  dateStart: "",
  dateEnd:   "",
  titularText:  "",
  defunctText:  "",
  partiesAText: "",
  partiesBText: "",
  notes: "",
};

// ---------------------------------------------------------------------------
// Hydrate form from API response
// ---------------------------------------------------------------------------

type ApiRecord = {
  documentTypeId: string;
  title:        string | null;
  nrDocument:   string | null;
  dateDocument: string | null;
  // Slice #18.16.VL: was `institution: string | null`
  institutionId: string | null;
  emitent:        string | null;
  bazaLegala:     string | null;
  uatProprietate: string | null;
  uatProprietar:  string | null;
  suprafata:      string | null;
  nrDosarSuccesoral: string | null;
  dataDecesului:     string | null;
  ultimulDomiciliu:  string | null;
  nrCertificatDeces: string | null;
  dateStart: string | null;
  dateEnd:   string | null;
  titularText:  string | null;
  defunctText:  string | null;
  partiesAText: string | null;
  partiesBText: string | null;
  notes:        string | null;
};

export function fromApiRecord(r: ApiRecord): FormValues {
  return {
    documentTypeId: r.documentTypeId,
    title:        r.title        ?? "",
    nrDocument:   r.nrDocument   ?? "",
    dateDocument: r.dateDocument ?? "",
    institutionId: r.institutionId ?? "",
    emitent:        r.emitent        ?? "",
    bazaLegala:     r.bazaLegala     ?? "",
    uatProprietate: r.uatProprietate ?? "",
    uatProprietar:  r.uatProprietar  ?? "",
    suprafata:      r.suprafata      ?? "",
    nrDosarSuccesoral: r.nrDosarSuccesoral ?? "",
    dataDecesului:     r.dataDecesului     ?? "",
    ultimulDomiciliu:  r.ultimulDomiciliu  ?? "",
    nrCertificatDeces: r.nrCertificatDeces ?? "",
    dateStart: r.dateStart ?? "",
    dateEnd:   r.dateEnd   ?? "",
    titularText:  r.titularText  ?? "",
    defunctText:  r.defunctText  ?? "",
    partiesAText: r.partiesAText ?? "",
    partiesBText: r.partiesBText ?? "",
    notes: r.notes ?? "",
  };
}

// ---------------------------------------------------------------------------
// Convert form values to API payload
// ---------------------------------------------------------------------------

export function toApiPayload(values: FormValues): Record<string, unknown> {
  const str = (v: string) => v.trim() || null;
  const dateStr = (v: string) => v || null;
  const uuid = (v: string) => v.trim() || null;
  const num = (v: string) => {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  return {
    documentTypeId: values.documentTypeId,
    title:        str(values.title),
    nrDocument:   str(values.nrDocument),
    dateDocument: dateStr(values.dateDocument),
    // Slice #18.16.VL: send as uuid or null
    institutionId: uuid(values.institutionId),
    emitent:        str(values.emitent),
    bazaLegala:     str(values.bazaLegala),
    uatProprietate: str(values.uatProprietate),
    uatProprietar:  str(values.uatProprietar),
    suprafata:      num(values.suprafata),
    nrDosarSuccesoral: str(values.nrDosarSuccesoral),
    dataDecesului:     dateStr(values.dataDecesului),
    ultimulDomiciliu:  str(values.ultimulDomiciliu),
    nrCertificatDeces: str(values.nrCertificatDeces),
    dateStart: dateStr(values.dateStart),
    dateEnd:   dateStr(values.dateEnd),
    titularText:  str(values.titularText),
    defunctText:  str(values.defunctText),
    partiesAText: str(values.partiesAText),
    partiesBText: str(values.partiesBText),
    notes: str(values.notes),
  };
}

// ===========================================================================
// Versioning (Slice #18.06) — snapshot conversion + pure diff helpers
//
// A "version" is a full snapshot of the document's own fields (flat). These
// helpers hydrate a snapshot into the form's value shape and derive — purely,
// by diffing snapshot N against N-1 — the version label colour and per-field
// highlight frames (green = added, red = modified/deleted). No corners, no
// subtypes, no satellites. Built on the shared primitives in
// @/lib/versioning/field-diff. All pure, so they unit-test directly.
// ===========================================================================

// The 21 document field names — identical between FormValues, DocumentSnapshot,
// and the migration backfill. Used for highlights and edit-dirty.
// Slice #18.16.VL: "institution" → "institutionId"
const DOC_FIELD_KEYS = [
  "documentTypeId", "title", "nrDocument", "dateDocument", "institutionId",
  "emitent", "bazaLegala", "uatProprietate", "uatProprietar", "suprafata",
  "nrDosarSuccesoral", "dataDecesului", "ultimulDomiciliu", "nrCertificatDeces",
  "dateStart", "dateEnd", "titularText", "defunctText", "partiesAText",
  "partiesBText", "notes",
] as const satisfies readonly (keyof FormValues)[];

/** Per-field highlight frames, keyed by document field name. */
export type DocumentFieldHighlights = Partial<
  Record<(typeof DOC_FIELD_KEYS)[number], HighlightColor>
>;

/** Snapshot → RHF form values (edit/view hydration). The snapshot is already a
 *  flat string|null map; documentTypeId is coerced to "" when absent. */
export function snapshotToFormValues(snap: DocumentSnapshot): FormValues {
  return fromApiRecord({ ...snap, documentTypeId: snap.documentTypeId ?? "" });
}

/** Per-field highlight frames for `curr` vs `prev` (empty for version 0). The
 *  DocumentSnapshot IS the flat field map, so it diffs directly. */
export function computeFieldHighlights(
  prev: DocumentSnapshot | null,
  curr: DocumentSnapshot,
): DocumentFieldHighlights {
  return diffFieldMap(prev, curr, DOC_FIELD_KEYS);
}

/** Version label colour. v0 green; red if any field modified/deleted; else green. */
export function versionLabelColor(
  prev: DocumentSnapshot | null,
  curr: DocumentSnapshot,
): HighlightColor {
  if (!prev) return "green";
  return labelColorFromHighlights(true, computeFieldHighlights(prev, curr));
}

/** True when two form-value sets are equal field-by-field (empty == ""). Used
 *  by edit mode to detect divergence from the loaded baseline, independent of
 *  RHF's reset-sensitive `isDirty`. */
export function formValuesEqual(a: FormValues, b: FormValues): boolean {
  for (const k of DOC_FIELD_KEYS) {
    if (normVal(a[k]) !== normVal(b[k])) return false;
  }
  return true;
}
