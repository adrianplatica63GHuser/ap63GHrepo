/**
 * React Hook Form schema + helpers for the Paperwork form.
 *
 * Keeps form state and API payload transformation in one place,
 * following the same pattern as the Property form-schema.
 */

import { z } from "zod/v4";
import { PAPERWORK_TYPES, type PaperworkType } from "@/lib/paperwork/validation";

// ---------------------------------------------------------------------------
// Form schema — mirrors validation.ts but uses empty string for nullable text
// so RHF text inputs remain controlled
// ---------------------------------------------------------------------------

export const formSchema = z.object({
  type:         z.enum(PAPERWORK_TYPES),
  title:        z.string(),
  nrDocument:   z.string(),
  dateDocument: z.string(), // "YYYY-MM-DD" or ""
  institution:  z.string(),

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
  type:         "ACT_ADJUDECARE",
  title:        "",
  nrDocument:   "",
  dateDocument: "",
  institution:  "",
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
  type:         PaperworkType;
  title:        string | null;
  nrDocument:   string | null;
  dateDocument: string | null;
  institution:  string | null;
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
    type:         r.type,
    title:        r.title        ?? "",
    nrDocument:   r.nrDocument   ?? "",
    dateDocument: r.dateDocument ?? "",
    institution:  r.institution  ?? "",
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
  const num = (v: string) => {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  return {
    type:         values.type,
    title:        str(values.title),
    nrDocument:   str(values.nrDocument),
    dateDocument: dateStr(values.dateDocument),
    institution:  str(values.institution),
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
