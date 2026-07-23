/**
 * Shared constants for the folder-scan / document-extraction API routes.
 *
 * KNOWN_TYPE_KEYS is derived from the seeded rows in lookup_document_type.
 * Keep this list in sync whenever new types are added via migration.
 *
 * Slice #19.06 — folder scan + extract.
 */

export const KNOWN_TYPE_KEYS = [
  "ACT_ADJUDECARE",
  "ACT_CADASTRU",
  "ACT_DONATIE",
  "AUTORIZATIE",
  "AUTORIZATIE_ALT",
  "AUTORIZATIE_CONSTRUIRE",
  "AVIZ_INSTITUTIE",
  "CARTE_IDENTITATE",
  "CARTE_IDENTITATE_ALT",
  "CASA",
  "CERTIFICAT_FISCAL",
  "CERTIFICAT_MOSTENITOR",
  "CERTIFICAT_SARCINI",
  "CERTIFICAT_SARCINI_ALT",
  "CERTIFICAT_URBANISM",
  "CONTRACT_ARENDA",
  "CONTRACT_INCHIRIERE",
  "CONTRACT_PARTAJ",
  "CONTRACT_PRESTARI_SERVICII",
  "CONTRACT_VANZARE",
  "DOCUMENTATIE_CADASTRALA",
  "EXTRAS_CARTE_FUNCIARA",
  "EXTRAS_CARTE_FUNCIARA_ALT",
  "EXTRAS_PUG",
  "HOTARARE_ADMINISTRATIVA",
  "HOTARARE_JUDECATOREASCA",
  "LINIARA",
  "PASUNE",
  "TEREN_ARABIL",
  "TEREN_CONSTRUIT",
  "TESTAMENT",
  "TITLU_PROPRIETATE",
  "UNCLASSIFIED",
] as const;

export type KnownTypeKey = (typeof KNOWN_TYPE_KEYS)[number];

// ---------------------------------------------------------------------------
// Phase 1 — classification (Haiku 4.5, cheap)
// ---------------------------------------------------------------------------

export const CLASSIFY_SYSTEM_PROMPT = `You classify Romanian official documents from scanned images or photos.
Your job is to identify what kind of document it is and whether structured data can be extracted from it.

Known document type keys (choose the closest match, or UNCLASSIFIED):
${KNOWN_TYPE_KEYS.join(", ")}

Respond with ONLY a single JSON object, no prose, no markdown fences.

Shape:
{
  "classifiedLabel": string,       // short human-readable Romanian name, e.g. "Titlu de Proprietate"
  "suggestedTypeKey": string,      // one of the known keys above, or null if none fits
  "confidence": "high" | "medium" | "low",
  "extractable": boolean,          // true if structured fields (title, number, date) can be read
  "notes": string | null           // optional 1-sentence note about unusual features or why it is not extractable
}

Rules:
- CARTE_IDENTITATE only when the document is clearly a Romanian national ID card (CI) or a similar personal identity card.
- If the image is blank, rotated beyond reading, or is a photograph of furniture/people (not a document), set extractable=false and suggestedTypeKey=null.
- If the document title is in the top-right corner (ANCPI template code), that is a strong signal — use it.
- Output strictly valid JSON — no comments, no trailing commas, no markdown code fences.`;

// ---------------------------------------------------------------------------
// Phase 2 — extraction (Sonnet 4.6, per approved file)
// ---------------------------------------------------------------------------

export const EXTRACT_SYSTEM_PROMPT = `You extract structured data from scanned Romanian official documents.
Respond with ONLY a single JSON object, no prose, no markdown fences.

Known document type keys (same list as classify — choose the closest, or null):
${KNOWN_TYPE_KEYS.filter((k) => k !== "UNCLASSIFIED").join(", ")}

Shape:
{
  "suggestedTypeKey": string | null,     // one of the known keys above, or null if none fits
  "classifiedLabel": string | null,      // short human-readable Romanian name for this document type, e.g. "Titlu de Proprietate"
  "fields": {
    "title": string | null,              // document title as printed
    "nrDocument": string | null,         // document number (nr. / no.)
    "dateDocument": string | null,       // issue date, ISO yyyy-mm-dd
    "institution": string | null,        // issuing institution
    "institutionId": string | null,      // institution internal code / CUI if printed
    "emitent": string | null,            // signatory / emitent name
    "bazaLegala": string | null,         // legal basis reference (lege, articol)
    "uatProprietate": string | null,     // UAT of the property
    "uatProprietar": string | null,      // UAT of the owner
    "suprafata": string | null,          // area/surface in m2 or ha — numeric string only, digits + decimal separator
    "nrDosarSuccesoral": string | null,  // succession dossier number
    "dataDecesului": string | null,      // date of death, ISO yyyy-mm-dd
    "ultimulDomiciliu": string | null,   // last domicile of deceased
    "nrCertificatDeces": string | null,  // death certificate number
    "dateStart": string | null,          // period start date, ISO yyyy-mm-dd
    "dateEnd": string | null,            // period end date, ISO yyyy-mm-dd
    "subject": string | null,            // brief subject / object of the document
    "notes": string | null               // any important information not captured by the above fields
  },
  "lowConfidenceFields": string[],       // field keys where you are not confident in the reading
  "unmappedRaw": { [label: string]: string }  // other printed text that does not fit any field above
}

Rules:
- Dates must be ISO yyyy-mm-dd or null. Convert Romanian format (zi.luna.an) to ISO.
- suprafata: numeric value only (e.g. "1234.56" or "0.45"), no units.
- Do not guess. If a field is not visible or not applicable for this document type, return null.
- Output strictly valid JSON — no comments, no trailing commas, no markdown code fences.`;

// ---------------------------------------------------------------------------
// Slice #21.03.Import — per-type extraction prompt (document-detail AI Interpret)
// ---------------------------------------------------------------------------
//
// EXTRACT_SYSTEM_PROMPT above is fixed and keeps serving the Import-wizard's
// folder-scan flow (scan-folder + extract-document routes) unchanged.
//
// The document-detail "AI Interpret" action
// (src/app/api/documents/[id]/ai-interpret/route.ts) builds its prompt
// dynamically instead: a small fixed baseline (title, nrDocument,
// dateDocument, subject — the fields every document type shows after the
// Slice #21.03.Import Phase 1 UI simplification) plus, when the document's
// type has one, that type's template_fields (see
// src/lib/documents/template-fields.ts). Anything the model finds that
// doesn't fit a known field — generic or template — goes into "unmappedRaw"
// and is folded into the document's Notes field by the route, never dropped.

import { templateFieldFormatHint, type DocumentTemplateField } from "@/lib/documents/template-fields";

export const GENERIC_EXTRACT_FIELD_DESCRIPTIONS: Record<string, string> = {
  title:        "document title as printed",
  nrDocument:   "document number (nr. / no.)",
  dateDocument: "issue date, ISO yyyy-mm-dd",
  subject:      "brief subject / object of the document",
};

export function buildExtractSystemPrompt(templateFields: DocumentTemplateField[]): string {
  const genericLines = Object.entries(GENERIC_EXTRACT_FIELD_DESCRIPTIONS)
    .map(([key, desc]) => `    "${key}": string | null,  // ${desc}`)
    .join("\n");

  const customLines = templateFields
    .map((f) => {
      const hint = f.aiHint?.trim() ? ` — ${f.aiHint.trim()}` : "";
      return `    "${f.key}": string | null,  // ${templateFieldFormatHint(f.type)}${hint} (${f.labelRo})`;
    })
    .join("\n");

  return `You extract structured data from scanned Romanian official documents.
Respond with ONLY a single JSON object, no prose, no markdown fences.

Known document type keys (same list as classify — choose the closest, or null):
${KNOWN_TYPE_KEYS.filter((k) => k !== "UNCLASSIFIED").join(", ")}

Shape:
{
  "suggestedTypeKey": string | null,     // one of the known keys above, or null if none fits
  "classifiedLabel": string | null,      // short human-readable Romanian name for this document type
  "fields": {
${genericLines}${customLines ? "\n" + customLines : ""}
  },
  "lowConfidenceFields": string[],       // field keys (generic or type-specific) where you are not confident
  "unmappedRaw": { [label: string]: string }  // ANY other printed text that does not fit a field above — never drop information
}

Rules:
- Dates must be ISO yyyy-mm-dd or null. Convert Romanian format (zi.luna.an) to ISO.
- Numbers must be numeric strings only (digits + decimal separator), no units.
- Do not guess. If a field is not visible or not applicable for this document, return null.
- Output strictly valid JSON — no comments, no trailing commas, no markdown code fences.`;
}
