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

// ---------------------------------------------------------------------------
// Slice #21.04.Import (party extraction) — structured people/organizations
// acting in one of the document type's configured lookup_doc_type_person_role
// roles (e.g. "Vânzător", "Cumpărător", "Notar", "Reprezentant legal /
// Mandatar"). Fully data-driven: the caller passes whatever role names are
// actually configured for the document's type — this module has no
// hardcoded notion of "seller" or "buyer". If a type has no roles configured
// at all, the caller should omit partyRoleNames (or pass []) and skip this
// section entirely rather than asking the model to guess at role names —
// matching the app's "admin-managed roles, never auto-guessed" convention.
// ---------------------------------------------------------------------------

export function buildExtractSystemPrompt(
  templateFields: DocumentTemplateField[],
  partyRoleNames: string[] = [],
): string {
  const genericLines = Object.entries(GENERIC_EXTRACT_FIELD_DESCRIPTIONS)
    .map(([key, desc]) => `    "${key}": string | null,  // ${desc}`)
    .join("\n");

  const customLines = templateFields
    .map((f) => {
      const hint = f.aiHint?.trim() ? ` — ${f.aiHint.trim()}` : "";
      return `    "${f.key}": string | null,  // ${templateFieldFormatHint(f.type)}${hint} (${f.labelRo})`;
    })
    .join("\n");

  const partiesSection = partyRoleNames.length > 0
    ? `,
  "parties": [                            // people/organizations acting in one of these roles for THIS document: ${partyRoleNames.join(", ")}
    {
      "roleName": string,                 // must exactly match one of: ${partyRoleNames.join(", ")}
      "personType": "NATURAL" | "JUDICIAL",
      "name": string | null,              // judicial: full legal name. natural: leave null if firstName/lastName given below
      "firstName": string | null,         // natural person only
      "lastName": string | null,          // natural person only
      "cnp": string | null,               // Romanian CNP (natural person only), digits only
      "cuiNumber": string | null,         // Romanian CUI (judicial person only)
      "idDocumentNumber": string | null,  // ID card series+number (natural person only)
      "idIssuingAuthority": string | null,
      "domiciliu": string | null,         // address / registered office, as printed
      "rawText": string                   // the full original text describing this party, verbatim
    }
  ]`
    : "";

  const partiesRule = partyRoleNames.length > 0
    ? "\n- \"parties\": one entry per distinct real person or organization — if a role has several people (e.g. multiple sellers), include one entry per person, all with the same roleName. Only include a party if the document actually names a specific person/organization for that role; never invent or guess an entry. Do not also repeat this party's information under \"unmappedRaw\" — parties are captured once, here."
    : "";

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
  "unmappedRaw": { [label: string]: string }  // ANY other printed text that does not fit a field above — never drop information${partiesSection}
}

Rules:
- Dates must be ISO yyyy-mm-dd or null. Convert Romanian format (zi.luna.an) to ISO.
- Numbers must be numeric strings only (digits + decimal separator), no units.
- Do not guess. If a field is not visible or not applicable for this document, return null.${partiesRule}
- Output strictly valid JSON — no comments, no trailing commas, no markdown code fences.`;
}

// ---------------------------------------------------------------------------
// Slice #21.10.Import — discover mode (schema-free reading)
// ---------------------------------------------------------------------------
//
// buildExtractSystemPrompt above is SCHEMA-DRIVEN: it hands the model a target
// field list (the generic baseline plus the type's template_fields) and asks it
// to fill those in, with `unmappedRaw` as the leftovers channel. That works well
// for a document type we already understand.
//
// It works badly for a type we do NOT understand yet. With no template the
// model is told to look for four fields and dump everything else into one flat
// map — and because that map is framed as leftovers, the model self-censors: it
// answers "what else is printed here?" rather than "read me this document".
// Adrian's ask (Slice #21.10.Import) is the opposite framing.
//
// So discover mode gives the model NO target fields at all. It asks for two
// lists instead:
//   recognised — every label -> value pair, both sides VERBATIM as printed
//   sections   — everything else, grouped by the model's own inferred headings,
//                in document order
//
// Nothing here is persisted. The result is printed to the dev-server console
// (see src/lib/documents/discover-log.ts) and returned in the response body so
// the same run can be inspected via browser automation — the precedent set by
// Slice #21.02.Import when it stopped making these diagnostics console-only.
//
// The deliberate design choice is VERBATIM on both sides of a pair. Normalising
// "Nr. cadastral" to some canonical key, or reformatting its value, is exactly
// the schema-fitting this mode exists to avoid: the printed Romanian label is
// the evidence for what a future template field should be called, and a
// normalised label has already thrown that evidence away.

export function buildDiscoverSystemPrompt(): string {
  return `You are reading a Romanian official document whose type this system does not yet understand.
There is NO target field list. Do not try to fit the document into a schema.
Your job is to report EVERYTHING the document says, split into two lists.

Respond with ONLY a single JSON object, no prose, no markdown fences.

Shape:
{
  "documentLabel": string | null,   // short Romanian name for what this appears to be, e.g. "Contract de arendă"
  "recognised": [                   // every label -> value pair you can read anywhere in the document
    {
      "name":       string,         // the label EXACTLY as printed in Romanian, e.g. "Nr. cadastral"
      "value":      string,         // the value EXACTLY as printed
      "confidence": "high" | "medium" | "low"
    }
  ],
  "sections": [                     // everything that is NOT a label -> value pair
    {
      "heading": string,            // the heading as printed, or a short Romanian description you infer if the block is unheaded
      "lines":   [string]           // that block's lines, verbatim, in the order printed
    }
  ]
}

Rules:
- "recognised" is for anything that reads as a field: a printed label followed by a value ("Nr. 1234", "Data: 12.04.2021", "Suprafață: 2.500 mp", a filled-in form box).
- VERBATIM ON BOTH SIDES. Do not translate the label. Do not rename it to a tidier or more canonical field name. Do not reformat the value — leave dates as "12.04.2021" if that is what is printed, leave "2.500,00 RON" with its Romanian separators. The exact printed wording is the point.
- "sections" is for prose, clauses, tables, signature blocks, stamps, headers and footers — anything with no label/value shape. Preserve document order, top to bottom, first page to last.
- Every piece of printed text must appear in exactly ONE of the two lists. Do not summarise, do not paraphrase, do not omit boilerplate, do not drop text you judge unimportant. Completeness matters more than tidiness in this mode.
- If something is hard to read, still report it and set confidence "low" — never drop it for being uncertain.
- Report what is printed, not what you infer it means. Never invent a label that is not on the page.
- Output strictly valid JSON — no comments, no trailing commas, no markdown code fences.`;
}
